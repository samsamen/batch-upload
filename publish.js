const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');
const { getConfig } = require('./config');
const gads = require('../lib/googleAds');
const { geoConstantToCode } = require('../lib/geoTargets');

const router = express.Router();

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GADS_SCOPE = 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/content';

// Build the callback URL. Behind Railway's proxy req.protocol is "http", so we
// honor x-forwarded-proto and default to https for any non-localhost host.
function buildRedirectUri(req) {
  const host = req.get('host') || '';
  const fwdProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  const proto = fwdProto || (isLocal ? 'http' : 'https');
  return `${proto}://${host}/api/google-ads/callback`;
}

// GET /api/google-ads/config — credential status (no secrets leaked)
router.get('/config', async (req, res) => {
  const cfg = await getConfig();
  res.json({
    has_client_id: !!cfg.gads_client_id,
    has_client_secret: !!cfg.gads_client_secret,
    has_developer_token: !!cfg.gads_developer_token,
    login_customer_id: cfg.gads_login_customer_id || '',
    client_id: cfg.gads_client_id || '',
    ready: !!(cfg.gads_client_id && cfg.gads_client_secret && cfg.gads_developer_token),
    env_managed: !!cfg._gads_from_env,
  });
});

// POST /api/google-ads/config — save app-level credentials (one-time)
router.post('/config', async (req, res) => {
  const { client_id, client_secret, developer_token, login_customer_id } = req.body;
  const update = { updated_at: new Date().toISOString() };
  if (client_id !== undefined) update.gads_client_id = client_id.trim();
  if (client_secret !== undefined) update.gads_client_secret = client_secret.trim();
  if (developer_token !== undefined) update.gads_developer_token = developer_token.trim();
  if (login_customer_id !== undefined) update.gads_login_customer_id = String(login_customer_id).replace(/\D/g, '');
  const { error } = await supabase.from('biq_config').update(update).eq('id', 1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/google-ads/auth-url?store_id=... — consent URL for ONE store
router.get('/auth-url', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id is required.' });
  const cfg = await getConfig();
  if (!cfg.gads_client_id) return res.status(400).json({ error: 'Enter the Google Ads OAuth Client ID first (one-time, top of Stores page).' });
  const redirectUri = buildRedirectUri(req);
  const params = new URLSearchParams({
    client_id: cfg.gads_client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GADS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: String(store_id),
  });
  res.json({ url: `${OAUTH_AUTH_URL}?${params.toString()}`, redirect_uri: redirectUri });
});

// GET /api/google-ads/callback — Google redirects here with ?code=&state=<store_id>
router.get('/callback', async (req, res) => {
  const { code, state, error: oauthErr } = req.query;
  if (oauthErr) return res.redirect(`/stores?gads_error=${encodeURIComponent(oauthErr)}`);
  if (!code || !state) return res.redirect('/stores?gads_error=missing_code_or_store');

  const cfg = await getConfig();
  const redirectUri = buildRedirectUri(req);
  try {
    const r = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.gads_client_id,
        client_secret: cfg.gads_client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const json = await r.json();
    if (!json.refresh_token) {
      return res.redirect(`/stores?gads_error=${encodeURIComponent('No refresh token returned. Remove BatchIQ at myaccount.google.com/permissions, then connect again.')}`);
    }
    const { error: saveErr } = await supabase.from('biq_stores')
      .update({ gads_refresh_token: json.refresh_token })
      .eq('id', state);
    if (saveErr) {
      // Most common cause: the gads_refresh_token column doesn't exist yet (migration not run)
      return res.redirect(`/stores?gads_error=${encodeURIComponent('Could not save the Google connection: ' + saveErr.message + '. Run the latest migration.sql in Supabase (it adds the gads_refresh_token column), then reconnect.')}`);
    }
    res.redirect(`/stores?gads_connected=${encodeURIComponent(state)}`);
  } catch (err) {
    res.redirect(`/stores?gads_error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/google-ads/accounts?store_id=... — accessible accounts (with names) for this store
router.get('/accounts', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id is required.' });
  const cfg = await getConfig();
  const { data: store } = await supabase.from('biq_stores')
    .select('gads_refresh_token').eq('id', store_id).single();
  if (!store || !store.gads_refresh_token) return res.status(400).json({ error: 'Connect this store to Google Ads first.' });
  try {
    const token = await gads.getAccessToken(cfg.gads_client_id, cfg.gads_client_secret, store.gads_refresh_token);
    const accounts = await gads.listAccountsWithNames(cfg, token);
    res.json({ accounts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/google-ads/store/:id — assign the Google Ads customer id to a store
router.patch('/store/:id', async (req, res) => {
  const { gads_customer_id } = req.body;
  const cid = String(gads_customer_id || '').replace(/\D/g, '');
  const { data, error } = await supabase.from('biq_stores')
    .update({ gads_customer_id: cid || null }).eq('id', req.params.id)
    .select('id, name, gads_customer_id').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/google-ads/store/:id/disconnect — clear this store's Google Ads link
router.post('/store/:id/disconnect', async (req, res) => {
  const { error } = await supabase.from('biq_stores')
    .update({ gads_refresh_token: null, gads_customer_id: null }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/google-ads/test-label?store_id=&label_index=&label_value=&days=
// Tests whether custom-label + geo querying works on the real account.
// Returns exactly what Google accepts so we know if the label approach is viable.
router.get('/test-label', async (req, res) => {
  const { store_id, label_index, label_value } = req.query;
  const days = parseInt(req.query.days) || 30;
  if (!store_id || label_index == null || !label_value) {
    return res.status(400).json({ error: 'store_id, label_index (0-4), and label_value are required.' });
  }
  const cfg = await getConfig();
  const { data: store } = await supabase.from('biq_stores')
    .select('name, gads_refresh_token, gads_customer_id, currency').eq('id', store_id).single();
  if (!store?.gads_refresh_token) return res.status(400).json({ error: 'Store not connected to Google Ads.' });
  if (!store.gads_customer_id) return res.status(400).json({ error: 'No Google Ads account selected for this store.' });

  const toDate = new Date(); const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().slice(0, 10), toStr = toDate.toISOString().slice(0, 10);

  try {
    const token = await gads.getAccessToken(cfg.gads_client_id, cfg.gads_client_secret, store.gads_refresh_token);
    const queryCfg = cfg.gads_login_customer_id ? cfg : { ...cfg, gads_login_customer_id: null };
    const result = await gads.getSpendByCustomLabelGeo(queryCfg, token, store.gads_customer_id, parseInt(label_index), label_value, fromStr, toStr);

    // Summarize
    const byGeo = {};
    let totalCost = 0;
    for (const r of result.rows) {
      const code = r.geoConstant ? (geoConstantToCode(r.geoConstant) || r.geoConstant) : 'ALL';
      byGeo[code] = (byGeo[code] || 0) + r.cost;
      totalCost += r.cost;
    }
    res.json({
      store: store.name,
      label: `custom_label_${label_index} = "${label_value}"`,
      date_range: `${fromStr} → ${toStr}`,
      rows_returned: result.rows.length,
      total_spend: Number(totalCost.toFixed(2)),
      geo_combined_worked: result.geo_combined,
      geo_error: result.geo_error || null,
      spend_by_country: Object.fromEntries(Object.entries(byGeo).map(([k, v]) => [k, Number(v.toFixed(2))])),
      verdict: result.rows.length === 0
        ? 'No data — check the label value matches exactly what is in your feed, and that 24-48h passed since setting it.'
        : result.geo_combined
          ? '✓ Custom label + per-country spend WORKS. This is the real solution.'
          : '✓ Custom label works, but Google rejected geo in the same query — spend is label-total only (no country split).',
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/google-ads/push-labels/:batchId
// Writes this batch's custom label onto its products in EACH store's Merchant
// Center, via that store's supplemental feed. This is what makes batch spend
// trackable by label (and combinable with geo) instead of matching product IDs.
router.post('/push-labels/:batchId', async (req, res) => {
  const content = require('../lib/contentApi');
  const { getProductsByTag } = require('../lib/shopifyApi');

  const { data: batch } = await supabase.from('biq_batches')
    .select(`id, name, batch_tag, batch_code, gads_label_index, gads_label_value,
      biq_batch_stores ( id, shopify_tag, biq_stores ( id, name, shop_domain, access_token, merchant_id, mc_supplemental_feed_id, gads_refresh_token ) )`)
    .eq('id', req.params.batchId).single();
  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const cfg = await getConfig();
  const labelIndex = batch.gads_label_index ?? 4;
  // Stable label value: explicit, else derived from the batch tag/code
  const labelValue = batch.gads_label_value || `BIQ-${(batch.batch_tag || batch.batch_code || batch.name).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)}`;

  const results = [];
  for (const bs of batch.biq_batch_stores || []) {
    const store = bs.biq_stores || {};
    const out = { store: store.name, label: `custom_label_${labelIndex} = "${labelValue}"` };

    if (!store.merchant_id) { out.error = 'No Merchant Center ID set on this store'; results.push(out); continue; }
    if (!store.mc_supplemental_feed_id) { out.error = 'No supplemental feed ID set (create one in Merchant Center, source = Content API)'; results.push(out); continue; }
    if (!store.gads_refresh_token) { out.error = 'Store not connected to Google (needs content scope — reconnect)'; results.push(out); continue; }

    try {
      // 1. Shopify product IDs in this batch for this store
      const tag = bs.shopify_tag || batch.batch_tag;
      const shopifyIds = await getProductsByTag(store, tag);
      const wanted = new Set(shopifyIds.map(String));
      if (wanted.size === 0) { out.error = `No products found for tag "${tag}"`; results.push(out); continue; }

      // 2. Content API token + list MC products
      const token = await gads.getAccessToken(cfg.gads_client_id, cfg.gads_client_secret, store.gads_refresh_token);
      const mcProducts = await content.listProducts(store.merchant_id, token);

      // 3. Match MC offerIds that contain one of this batch's Shopify IDs
      const matched = mcProducts.filter(p => {
        const tokens = String(p.offerId).split(/[^0-9]+/).filter(Boolean);
        return tokens.some(t => wanted.has(t));
      });
      if (matched.length === 0) {
        out.error = `0 of ${mcProducts.length} Merchant Center products matched this batch's ${wanted.size} Shopify IDs`;
        results.push(out); continue;
      }

      // 4. Write the custom label via supplemental feed
      const writeRes = await content.setCustomLabelSupplemental(store.merchant_id, store.mc_supplemental_feed_id, token, matched, labelIndex, labelValue);
      out.matched_products = matched.length;
      out.updated = writeRes.updated;
      out.write_errors = writeRes.errors.length;
      if (writeRes.errors.length) out.sample_error = writeRes.errors[0]?.message;

      await supabase.from('biq_stores').update({ content_api_ok: true, content_api_checked_at: new Date().toISOString() }).eq('id', store.id).then(() => {}, () => {});
    } catch (err) {
      out.error = err.message;
      await supabase.from('biq_stores').update({ content_api_ok: false, content_api_checked_at: new Date().toISOString() }).eq('id', store.id).then(() => {}, () => {});
    }
    results.push(out);
  }

  // Persist the resolved label so spend sync uses the same value
  await supabase.from('biq_batches').update({
    gads_label_index: labelIndex, gads_label_value: labelValue, labels_pushed_at: new Date().toISOString(),
  }).eq('id', batch.id).then(() => {}, () => {});

  res.json({ batch: batch.name, label: `custom_label_${labelIndex} = "${labelValue}"`, results });
});

module.exports = router;
