const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// GET /api/research — all ideas, with linked batch name
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('biq_research')
    .select(`
      id, title, note, status, source, results, tags, batch_id, position, created_at, updated_at,
      biq_batches ( id, name, batch_tag )
    `)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/research — create idea
router.post('/', async (req, res) => {
  const { title, note, status, source, results, tags, batch_id } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  const { data, error } = await supabase
    .from('biq_research')
    .insert({
      title, note: note || null, status: status || 'backlog',
      source: source || null, results: results || null,
      tags: tags || [], batch_id: batch_id || null,
    })
    .select(`*, biq_batches ( id, name, batch_tag )`)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PATCH /api/research/:id — update idea (incl. status change from drag)
router.patch('/:id', async (req, res) => {
  const { title, note, status, source, results, tags, batch_id, position } = req.body;
  const update = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries({ title, note, status, source, results, tags, batch_id, position })) {
    if (v !== undefined) update[k] = v;
  }

  const { data, error } = await supabase
    .from('biq_research')
    .update(update)
    .eq('id', req.params.id)
    .select(`*, biq_batches ( id, name, batch_tag )`)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/research/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('biq_research').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
