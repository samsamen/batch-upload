const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// GET /api/stores — list all active stores
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('biq_stores')
    .select('id, shop_domain, name, country, currency, active, connected_at')
    .eq('active', true)
    .order('name');

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/stores/:id — single store
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('biq_stores')
    .select('id, shop_domain, name, country, currency, active, connected_at')
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Store not found' });
  res.json(data);
});

// PATCH /api/stores/:id — update country/currency/name
router.patch('/:id', async (req, res) => {
  const { name, country, currency } = req.body;

  const { data, error } = await supabase
    .from('biq_stores')
    .update({ name, country, currency })
    .eq('id', req.params.id)
    .select('id, shop_domain, name, country, currency')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/stores/:id — deactivate (soft delete)
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('biq_stores')
    .update({ active: false })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
