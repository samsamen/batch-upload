const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');
const { getConfig } = require('./config');
const { getAccessToken, getMarkets } = require('../lib/shopifyAuth');

const router = express.Router();

// GET /api/stores — list stores. ?include=all also returns disconnected ones.
router.get('/', async (req, res) => {
  let q = supabase
    .from('biq_stores')
    .select('id, shop_domain, name, country, currency, markets, active, connected_at')
    .order('name');
  if (req.query.include !== 'all') q = q.eq('active', true);
  const { data, error } = await q;
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
  let { markets } = await getMarkets(shop_domain, accessToken);
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

  // Onboard = sync immediately so data shows up right away (runs in background)
  const { syncStoreNow } = require('./sync');
  if (typeof syncStoreNow === 'function') {
    syncStoreNow(data.id, 30).catch(err => console.error('Onboard sync:', err.message));
  }

  res.status(201).json(data);
});

// PATCH /api/stores/:id
router.patch('/:id', async (req, res) => {
  let { name, country, currency, markets, client_id, client_secret, shop_domain } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (country !== undefined) update.country = country;
  if (currency !== undefined) update.currency = currency;
  if (markets !== undefined) update.markets = markets;

  // Update global app credentials if provided
  if (client_id || client_secret) {
    const cfg = await getConfig();
    await supabase.from('biq_config').update({
      shopify_client_id: client_id || cfg.shopify_client_id,
      shopify_client_secret: client_secret || cfg.shopify_client_secret,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
  }

  // Allow correcting the Shopify store URL
  if (shop_domain !== undefined && shop_domain.trim()) {
    shop_domain = shop_domain.replace(/https?:\/\//, '').replace(/\/$/, '').trim();
    if (!shop_domain.includes('.myshopify.com')) {
      return res.status(400).json({ error: 'Store URL must end in .myshopify.com' });
    }
    update.shop_domain = shop_domain;

    // Re-verify with a fresh token so the corrected domain actually works
    const cfg = await getConfig();
    const cid = client_id || cfg.shopify_client_id;
    const csec = client_secret || cfg.shopify_client_secret;
    if (cid && csec) {
      try {
        const newToken = await getAccessToken(shop_domain, cid, csec);
        update.access_token = newToken;
      } catch (err) {
        return res.status(400).json({ error: `New URL could not be verified: ${err.message}` });
      }
    }
  }

  const { data, error } = await supabase
    .from('biq_stores')
    .update(update)
    .eq('id', req.params.id)
    .select('id, shop_domain, name, country, currency, markets')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/stores/:id/refresh-markets — pull markets fresh from Shopify
router.post('/:id/refresh-markets', async (req, res) => {
  const { data: store, error } = await supabase
    .from('biq_stores').select('id, shop_domain, access_token').eq('id', req.params.id).single();
  if (error || !store) return res.status(404).json({ error: 'Store not found' });

  let token = store.access_token;
  const cfg = await getConfig();
  if (cfg.shopify_client_id && cfg.shopify_client_secret) {
    try { token = await getAccessToken(store.shop_domain, cfg.shopify_client_id, cfg.shopify_client_secret); } catch (e) {
      return res.status(400).json({ error: `Token refresh failed: ${e.message}` });
    }
  }

  const { markets, error: mErr } = await getMarkets(store.shop_domain, token);
  if (markets.length > 0) {
    await supabase.from('biq_stores').update({ markets }).eq('id', store.id);
  }
  res.json({ success: true, markets, marketError: mErr || null });
});

// POST /api/stores/:id/reconnect — re-fetch a fresh token (e.g. after scope change)
router.post('/:id/reconnect', async (req, res) => {
  const { data: store, error } = await supabase
    .from('biq_stores').select('id, shop_domain, name').eq('id', req.params.id).single();
  if (error || !store) return res.status(404).json({ error: 'Store not found' });

  const cfg = await getConfig();
  if (!cfg.shopify_client_id || !cfg.shopify_client_secret) {
    return res.status(400).json({ error: 'No app credentials saved. Add Client ID + Secret first.' });
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(store.shop_domain, cfg.shopify_client_id, cfg.shopify_client_secret);
  } catch (err) {
    return res.status(400).json({ error: `Reconnect failed: ${err.message}` });
  }

  // Refresh markets too, now that scopes may have changed
  const { markets } = await getMarkets(store.shop_domain, accessToken);
  const update = { access_token: accessToken, active: true };
  if (markets.length > 0) update.markets = markets;

  const { data, error: upErr } = await supabase
    .from('biq_stores').update(update).eq('id', store.id)
    .select('id, shop_domain, name, country, currency, markets, active').single();
  if (upErr) return res.status(500).json({ error: upErr.message });
  res.json({ success: true, store: data, markets });
});

// DELETE /api/stores/:id — disconnect (soft) by default, or ?hard=true to remove permanently
router.delete('/:id', async (req, res) => {
  if (req.query.hard === 'true') {
    const { error } = await supabase.from('biq_stores').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true, deleted: true });
  }
  const { error } = await supabase
    .from('biq_stores').update({ active: false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
