const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');
const { getConfig } = require('./config');
const { getAccessToken, getMarkets } = require('../lib/shopifyAuth');

const router = express.Router();

// GET /api/stores — list stores. ?include=all also returns disconnected ones.
router.get('/', async (req, res) => {
  const full = 'id, shop_domain, name, country, currency, markets, active, connected_at, gads_customer_id, gads_refresh_token, access_token, client_id, shopify_ok, gads_ok, merchant_id, mc_supplemental_feed_id, content_api_ok';
  const base = 'id, shop_domain, name, country, currency, markets, active, connected_at, access_token, client_id, merchant_id, mc_supplemental_feed_id';

  async function run(cols) {
    let q = supabase.from('biq_stores').select(cols).order('name');
    if (req.query.include !== 'all') q = q.eq('active', true);
    return q;
  }

  let { data, error } = await run(full);
  // If new columns don't exist yet (migration not run), retry without them
  if (error) {
    const retry = await run(base);
    data = retry.data; error = retry.error;
  }
  if (error) return res.status(500).json({ error: error.message });

  const out = (data || []).map(s => ({
    id: s.id, shop_domain: s.shop_domain, name: s.name, country: s.country,
    currency: s.currency, markets: s.markets, active: s.active, connected_at: s.connected_at,
    gads_customer_id: s.gads_customer_id || null,
    // Shopify dot: green if last sync verified it OR (never synced yet but creds present)
    shopify_verified: s.shopify_ok === true || (s.shopify_ok == null && !!(s.access_token && s.client_id)),
    gads_connected: !!s.gads_refresh_token,
    // An account is "picked" purely if a customer id is saved — independent of query health.
    gads_account_picked: !!(s.gads_refresh_token && s.gads_customer_id),
    // "linked & healthy": picked AND last query didn't fail
    gads_linked: !!(s.gads_refresh_token && s.gads_customer_id) && (s.gads_ok === true || s.gads_ok == null),
    gads_error: s.gads_ok === false,
  }));
  res.json(out);
});

// POST /api/stores/connect — add a store using ITS OWN client credentials.
// Body: { shop_domain, client_id, client_secret, name?, feed_language? }
router.post('/connect', async (req, res) => {
  let { shop_domain, name, feed_language, client_id, client_secret } = req.body;

  if (!shop_domain) return res.status(400).json({ error: 'Store URL is required.' });

  shop_domain = shop_domain.replace(/https?:\/\//, '').replace(/\/$/, '').trim();
  if (!shop_domain.includes('.myshopify.com')) {
    return res.status(400).json({ error: 'Store URL must end in .myshopify.com' });
  }

  // Each store has its OWN custom app keys — required for every store.
  const useClientId = (client_id || '').trim();
  const useSecret = (client_secret || '').trim();
  if (!useClientId || !useSecret) {
    return res.status(400).json({ error: 'Enter this store\u2019s own Client ID and Secret (each store has its own app).' });
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

  // Save store WITH its own keys
  const { data, error } = await supabase.from('biq_stores').upsert(
    {
      shop_domain, name: storeName, access_token: accessToken,
      client_id: useClientId, client_secret: useSecret,
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
  let { name, country, currency, markets, client_id, client_secret, shop_domain, merchant_id, mc_supplemental_feed_id, listing_guidance } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (country !== undefined) update.country = country;
  if (currency !== undefined) update.currency = currency;
  if (markets !== undefined) update.markets = markets;
  if (merchant_id !== undefined) update.merchant_id = merchant_id;
  if (mc_supplemental_feed_id !== undefined) update.mc_supplemental_feed_id = mc_supplemental_feed_id;
  if (listing_guidance !== undefined) update.listing_guidance = listing_guidance;

  // Save app credentials ON THIS STORE (each store has its own app)
  if (client_id) update.client_id = client_id.trim();
  if (client_secret) update.client_secret = client_secret.trim();

  // Allow correcting the Shopify store URL
  if (shop_domain !== undefined && shop_domain.trim()) {
    shop_domain = shop_domain.replace(/https?:\/\//, '').replace(/\/$/, '').trim();
    if (!shop_domain.includes('.myshopify.com')) {
      return res.status(400).json({ error: 'Store URL must end in .myshopify.com' });
    }
    update.shop_domain = shop_domain;

    // Re-verify with a fresh token using THIS store's keys
    const { data: existing } = await supabase.from('biq_stores')
      .select('client_id, client_secret').eq('id', req.params.id).single();
    const cid = (client_id || existing?.client_id || '').trim();
    const csec = (client_secret || existing?.client_secret || '').trim();
    if (cid && csec) {
      try {
        update.access_token = await getAccessToken(shop_domain, cid, csec);
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
    .from('biq_stores').select('id, shop_domain, access_token, client_id, client_secret').eq('id', req.params.id).single();
  if (error || !store) return res.status(404).json({ error: 'Store not found' });

  let token = store.access_token;
  if (store.client_id && store.client_secret) {
    try { token = await getAccessToken(store.shop_domain, store.client_id, store.client_secret); } catch (e) {
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
    .from('biq_stores').select('id, shop_domain, name, client_id, client_secret').eq('id', req.params.id).single();
  if (error || !store) return res.status(404).json({ error: 'Store not found' });

  if (!store.client_id || !store.client_secret) {
    return res.status(400).json({ error: 'This store has no Client ID/Secret saved. Open Edit and add this store\u2019s own app keys.' });
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(store.shop_domain, store.client_id, store.client_secret);
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

// GET /api/stores/runway — per-store scheduling runway: how many upcoming
// scheduled batches each store has, how many days ahead they're covered, and
// how many batches are ready but not yet scheduled. Lets you see where to add.
router.get('/runway', async (req, res) => {
  const target = parseInt(req.query.target) || 7; // target days of runway
  const today = new Date().toISOString().slice(0, 10);

  const { data: links, error } = await supabase.from('biq_batch_stores')
    .select(`id, published_at,
      biq_stores ( id, name, active ),
      biq_batches ( id, name, go_live_date, published_at, status )`);
  if (error) return res.status(500).json({ error: error.message });

  const byStore = {};
  for (const l of links || []) {
    const st = l.biq_stores; const b = l.biq_batches;
    if (!st || !b) continue;
    if (st.active === false) continue;
    if (!byStore[st.id]) byStore[st.id] = { store_id: st.id, store: st.name, upcoming: [], unscheduled: 0, live_count: 0 };
    const grp = byStore[st.id];

    const isPublished = !!l.published_at || !!b.published_at;
    if (isPublished) { grp.live_count++; continue; }
    if (b.status === 'archived') continue;

    if (b.go_live_date) {
      if (b.go_live_date >= today) grp.upcoming.push({ batch_id: b.id, name: b.name, date: b.go_live_date });
      // past-dated but unpublished = overdue; surface as upcoming with overdue flag
      else grp.upcoming.push({ batch_id: b.id, name: b.name, date: b.go_live_date, overdue: true });
    } else {
      grp.unscheduled++;
    }
  }

  const stores = Object.values(byStore).map(g => {
    g.upcoming.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const futureDates = [...new Set(g.upcoming.filter(u => !u.overdue).map(u => u.date))];
    const furthest = futureDates.length ? futureDates[futureDates.length - 1] : null;
    const runwayDays = furthest ? Math.max(0, Math.round((new Date(furthest) - new Date(today)) / 86400000)) + 1 : 0;
    return {
      ...g,
      scheduled_count: g.upcoming.filter(u => !u.overdue).length,
      overdue_count: g.upcoming.filter(u => u.overdue).length,
      distinct_days: futureDates.length,
      furthest_date: furthest,
      runway_days: runwayDays,
      runway_pct: Math.min(100, Math.round((runwayDays / target) * 100)),
    };
  }).sort((a, b) => a.runway_days - b.runway_days); // lowest runway first (needs attention)

  res.json({ target_days: target, today, stores });
});

module.exports = router;
