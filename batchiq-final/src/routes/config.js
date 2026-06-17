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

// Helper used by shopify route — get full config including secret
async function getConfig() {
  const { data } = await supabase
    .from('biq_config')
    .select('shopify_client_id, shopify_client_secret, app_url')
    .eq('id', 1)
    .single();
  return data || {};
}

module.exports = router;
module.exports.getConfig = getConfig;
