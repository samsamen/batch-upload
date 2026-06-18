const express = require('express');
const fetch = require('node-fetch');
const supabase = require('../lib/supabase');
const { getConfig } = require('./config');
const gads = require('../lib/googleAds');

const router = express.Router();

const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

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

module.exports = router;
