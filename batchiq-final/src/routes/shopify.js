const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');

const router = express.Router();

const SCOPES = 'read_orders,read_products';

// ── Step 1: Redirect user to Shopify OAuth consent screen ──────────────────
// GET /api/shopify/auth?shop=mystore.myshopify.com
router.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop parameter' });

  const cleanShop = shop
    .replace('https://', '')
    .replace('http://', '')
    .replace(/\/$/, '')
    .trim();

  if (!cleanShop.includes('.myshopify.com')) {
    return res.status(400).json({ error: 'Domain must end in .myshopify.com' });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL}/api/shopify/callback`;
  const state = Buffer.from(JSON.stringify({ shop: cleanShop })).toString('base64url');

  const authUrl =
    `https://${cleanShop}/admin/oauth/authorize` +
    `?client_id=${clientId}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
});

// ── Step 2: Shopify redirects here after user approves ─────────────────────
// GET /api/shopify/callback?code=...&shop=...&state=...
router.get('/callback', async (req, res) => {
  const { code, shop, state } = req.query;

  if (!code || !shop || !state) {
    return res.status(400).send('Missing required parameters from Shopify.');
  }

  // Decode state to verify shop
  let stateData;
  try {
    stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
  } catch {
    return res.status(400).send('Invalid state parameter.');
  }

  if (stateData.shop !== shop) {
    return res.status(403).send('State mismatch — possible CSRF attack.');
  }

  // Exchange code for permanent access token
  let accessToken;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;
  } catch (err) {
    console.error('OAuth token exchange error:', err.message);
    return res.status(500).send(`OAuth error: ${err.message}`);
  }

  // Get store name from Shopify
  let storeName = shop;
  try {
    const shopRes = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    const shopData = await shopRes.json();
    storeName = shopData.shop?.name || shop;
  } catch {
    // Non-fatal — fallback to domain
  }

  // Upsert store in Supabase
  const { error } = await supabase.from('biq_stores').upsert(
    {
      shop_domain: shop,
      name: storeName,
      access_token: accessToken,
      active: true,
      connected_at: new Date().toISOString(),
    },
    { onConflict: 'shop_domain' }
  );

  if (error) {
    console.error('Supabase upsert error:', error.message);
    return res.status(500).send(`Database error: ${error.message}`);
  }

  // Redirect back to frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/stores?connected=${encodeURIComponent(storeName)}`);
});

module.exports = router;
