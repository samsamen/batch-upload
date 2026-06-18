const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');
const { getConfig } = require('./config');
const { getAccessToken, getMarkets } = require('../lib/shopifyAuth');

const router = express.Router();

// GET /api/stores — list active stores
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('biq_stores')
    .select('id, shop_domain, name, country, currency, markets, active, connected_at')
    .eq('active', true)
    .order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/stores/connect — add a store using client credentials (no login)
// Body: { shop_domain, name?, feed_language?, client_id?, client_secret? }
router.post('/connect', async (req, res) => {
  let { shop_domain, name, feed_language, client_id, client_secret } = req.body;

  if (!shop_domain) return res.status(400).json({ error: 'Store URL is required.' });

  shop_domain = shop_domain.replace(/https?:\/\//, '').replace(/\/$/, '').trim();
  if (!shop_domain.includes('.myshopify.com')) {
    return res.status(400).json({ error: 'Store URL must end in .myshopify.com' });
  }

  const cfg = await getConfig();
  const useClientId = client_id || cfg.shopify_client_id;
  const useSecret = client_secret || cfg.shopify_client_secret;

  if (!useClientId || !useSecret) {
    return res.status(400).json({ error: 'No Shopify credentials. Enter Client ID and Secret.' });
  }

  if (client_id || client_secret) {
    await supabase.from('biq_config').update({
      shopify_client_id: useClientId,
      shopify_client_secret: useSecret,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(shop_domain, useClientId, useSecret);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Fetch store details
  let storeName = name || shop_domain, country = null, currency = 'EUR';
  try {
    const r = await fetch(`https://${shop_domain}/admin/api/2024-01/shop.json`, {
      headers: { 'X-Shopify-Access-Token': accessToken },
    });
    const d = (await r.json()).shop;
    if (d) {
      storeName = name || d.name || shop_domain;
      country = d.country_code || null;
      currency = d.currency || 'EUR';
    }
  } catch {}

  // Fetch markets (countries) — needs read_markets scope, else falls back to shop country
  let markets = await getMarkets(shop_domain, accessToken);
  if (markets.length === 0 && country) markets = [country];

  // Save store
  const { data, error } = await supabase.from('biq_stores').upsert(
    {
      shop_domain, name: storeName, access_token: accessToken,
      country, currency, feed_language: feed_language || null,
      markets,
      active: true, connected_at: new Date().toISOString(),
    },
    { onConflict: 'shop_domain' }
  ).select('id, shop_domain, name, country, currency, markets').single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/stores/:id
router.patch('/:id', async (req, res) => {
  const { name, country, currency, markets } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (country !== undefined) update.country = country;
  if (currency !== undefined) update.currency = currency;
  if (markets !== undefined) update.markets = markets;

  const { data, error } = await supabase
    .from('biq_stores')
    .update(update)
    .eq('id', req.params.id)
    .select('id, shop_domain, name, country, currency, markets')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/stores/:id — soft delete
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('biq_stores').update({ active: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
