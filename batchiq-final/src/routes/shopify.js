const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');
const { getConfig } = require('./config');

const router = express.Router();

const SCOPES = 'read_orders,read_products';

// ── Step 1: Redirect to Shopify OAuth ──────────────────────────────────────
router.get('/auth', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop parameter');

  const cleanShop = shop.replace(/https?:\/\//, '').replace(/\/$/, '').trim();
  if (!cleanShop.includes('.myshopify.com')) {
    return res.status(400).send('Domain must end in .myshopify.com');
  }

  const cfg = await getConfig();
  if (!cfg.shopify_client_id) {
    return res.status(400).send('Shopify Client ID not set. Go to Settings and add your Shopify keys first.');
  }

  const appUrl = cfg.app_url || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${appUrl}/api/shopify/callback`;
  const state = Buffer.from(JSON.stringify({ shop: cleanShop })).toString('base64url');

  const authUrl =
    `https://${cleanShop}/admin/oauth/authorize` +
    `?client_id=${cfg.shopify_client_id}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
});

// ── Step 2: OAuth callback ─────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, shop, state } = req.query;
  if (!code || !shop || !state) return res.status(400).send('Missing parameters from Shopify.');

  let stateData;
  try { stateData = JSON.parse(Buffer.from(state, 'base64url').toString()); }
  catch { return res.status(400).send('Invalid state.'); }
  if (stateData.shop !== shop) return res.status(403).send('State mismatch.');

  const cfg = await getConfig();
  if (!cfg.shopify_client_id || !cfg.shopify_client_secret) {
    return res.status(400).send('Shopify keys not configured.');
  }

  // Exchange code for access token
  let accessToken;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.shopify_client_id,
        client_secret: cfg.shopify_client_secret,
        code,
      }),
    });
    if (!tokenRes.ok) throw new Error(await tokenRes.text());
    accessToken = (await tokenRes.json()).access_token;
  } catch (err) {
    return res.status(500).send(`OAuth error: ${err.message}`);
  }

  // Get store name + country
  let storeName = shop, country = null, currency = 'EUR';
  try {
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    const d = (await shopRes.json()).shop;
    storeName = d?.name || shop;
    country = d?.country_code || null;
    currency = d?.currency || 'EUR';
  } catch {}

  // Save store to Supabase
  const { error } = await supabase.from('biq_stores').upsert(
    { shop_domain: shop, name: storeName, access_token: accessToken, country, currency, active: true, connected_at: new Date().toISOString() },
    { onConflict: 'shop_domain' }
  );
  if (error) return res.status(500).send(`Database error: ${error.message}`);

  const appUrl = cfg.app_url || `${req.protocol}://${req.get('host')}`;
  res.redirect(`${appUrl}/stores?connected=${encodeURIComponent(storeName)}`);
});

module.exports = router;
