const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// GET /api/config — return config (secret masked)
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('biq_config')
    .select('shopify_client_id, app_url, shopify_client_secret')
    .eq('id', 1)
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({
    shopify_client_id: data?.shopify_client_id || '',
    app_url: data?.app_url || '',
    has_secret: !!data?.shopify_client_secret,
  });
});

// PATCH /api/config — save Shopify keys
router.patch('/', async (req, res) => {
  const { shopify_client_id, shopify_client_secret, app_url } = req.body;

  const update = { updated_at: new Date().toISOString() };
  if (shopify_client_id !== undefined) update.shopify_client_id = shopify_client_id;
  if (app_url !== undefined) update.app_url = app_url;
  // Only update secret if a new non-empty one is provided
  if (shopify_client_secret) update.shopify_client_secret = shopify_client_secret;

  const { error } = await supabase
    .from('biq_config')
    .update(update)
    .eq('id', 1);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Helper used by other routes — get full config, with ENV VARS taking priority
// over DB values for Google Ads credentials (the SaaS-safe way: keys live in
// Railway env vars, never exposed to the browser).
async function getConfig() {
  let cfg = {};
  // Try the full select (with gads columns); if those columns don't exist yet,
  // fall back to the base columns so env-var detection still works.
  try {
    const { data, error } = await supabase
      .from('biq_config')
      .select('shopify_client_id, shopify_client_secret, app_url, gads_client_id, gads_client_secret, gads_developer_token, gads_login_customer_id')
      .eq('id', 1)
      .single();
    if (error) throw error;
    cfg = data || {};
  } catch (e) {
    // gads columns probably missing — retry with just the base Shopify columns
    try {
      const { data } = await supabase
        .from('biq_config')
        .select('shopify_client_id, shopify_client_secret, app_url')
        .eq('id', 1)
        .single();
      cfg = data || {};
    } catch { cfg = {}; }
  }

  // Google Ads: prefer env vars, fall back to DB-stored values (if present)
  cfg.gads_client_id = process.env.GADS_CLIENT_ID || cfg.gads_client_id || null;
  cfg.gads_client_secret = process.env.GADS_CLIENT_SECRET || cfg.gads_client_secret || null;
  cfg.gads_developer_token = process.env.GADS_DEVELOPER_TOKEN || cfg.gads_developer_token || null;
  cfg.gads_login_customer_id = process.env.GADS_LOGIN_CUSTOMER_ID || cfg.gads_login_customer_id || null;
  cfg._gads_from_env = !!(process.env.GADS_CLIENT_ID && process.env.GADS_CLIENT_SECRET && process.env.GADS_DEVELOPER_TOKEN);

  return cfg;
}

module.exports = router;
module.exports.getConfig = getConfig;
