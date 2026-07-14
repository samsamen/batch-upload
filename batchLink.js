const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// GET /api/activity — recent activity, newest first
router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 300);
  const { data, error } = await supabase
    .from('biq_activity')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/activity — clear the log
router.delete('/', async (req, res) => {
  const { error } = await supabase.from('biq_activity').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
