const express = require('express');
const supabase = require('../lib/supabase');

const router = express.Router();

// ── Batch code generator: B2606-A, B2606-B … ──────────────────────────────
async function generateBatchCode() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `B${yy}${mm}`;

  const { data } = await supabase
    .from('biq_batches')
    .select('batch_code')
    .like('batch_code', `${prefix}-%`);

  const existingSuffixes = (data || [])
    .map((r) => r.batch_code.replace(`${prefix}-`, ''))
    .filter((s) => /^[A-Z]$/.test(s));

  if (existingSuffixes.length === 0) return `${prefix}-A`;

  const lastChar = existingSuffixes.sort().at(-1);
  const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
  return `${prefix}-${nextChar}`;
}

// ── GET /api/batches — list all batches with aggregate performance ──────────
router.get('/', async (req, res) => {
  const { data: batches, error } = await supabase
    .from('biq_batches')
    .select(`
      id, batch_code, name, source, thesis, tags, status, created_at,
      biq_batch_stores (
        id, shopify_tag, product_count, notes,
        biq_stores ( id, name, shop_domain, country, currency ),
        biq_performance_daily ( date, orders, revenue, units_sold )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Aggregate totals per batch
  const enriched = (batches || []).map((batch) => {
    let totalOrders = 0;
    let totalRevenue = 0;
    let totalUnits = 0;
    const storeCount = batch.biq_batch_stores?.length || 0;

    for (const bs of batch.biq_batch_stores || []) {
      for (const perf of bs.biq_performance_daily || []) {
        totalOrders += perf.orders || 0;
        totalRevenue += parseFloat(perf.revenue || 0);
        totalUnits += perf.units_sold || 0;
      }
    }

    return {
      ...batch,
      totals: { orders: totalOrders, revenue: totalRevenue, units: totalUnits },
      store_count: storeCount,
    };
  });

  res.json(enriched);
});

// ── GET /api/batches/:id — single batch with full detail ───────────────────
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('biq_batches')
    .select(`
      id, batch_code, name, source, thesis, validation_notes, tags, status, created_at,
      biq_batch_stores (
        id, shopify_tag, product_count, notes, added_at,
        biq_stores ( id, name, shop_domain, country, currency ),
        biq_performance_daily ( date, orders, revenue, units_sold, ad_spend, clicks, impressions )
      )
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'Batch not found' });
  res.json(data);
});

// ── POST /api/batches — create a new batch ─────────────────────────────────
router.post('/', async (req, res) => {
  const { name, source, thesis, validation_notes, tags, batch_tag } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });

  const batch_code = await generateBatchCode();

  const { data, error } = await supabase
    .from('biq_batches')
    .insert({ batch_code, batch_tag: batch_tag || null, name, source, thesis, validation_notes, tags: tags || [] })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PATCH /api/batches/:id — update batch metadata ─────────────────────────
router.patch('/:id', async (req, res) => {
  const { name, source, thesis, validation_notes, tags, status, batch_tag } = req.body;

  const { data, error } = await supabase
    .from('biq_batches')
    .update({ name, source, thesis, validation_notes, tags, status, batch_tag })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/batches/:id — archive batch ────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('biq_batches')
    .update({ status: 'archived' })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── GET /api/batches/:id/suggest-tag?store_id=... — auto-suggest store sub-tag
router.get('/:id/suggest-tag', async (req, res) => {
  const { store_id } = req.query;
  if (!store_id) return res.status(400).json({ error: 'store_id required' });

  const [{ data: batch }, { data: store }] = await Promise.all([
    supabase.from('biq_batches').select('batch_tag').eq('id', req.params.id).single(),
    supabase.from('biq_stores').select('country, name').eq('id', store_id).single(),
  ]);

  if (!batch) return res.status(404).json({ error: 'Batch not found' });

  const parentTag = batch.batch_tag || '';
  const country = (store?.country || '').toLowerCase().slice(0, 2); // fi, fr, uk, pl...

  // Suggest: parent tag + country code, or just parent tag if no country
  const suggested = parentTag
    ? country ? `${parentTag}-${country}` : parentTag
    : '';

  res.json({ suggested, parent_tag: parentTag, country_code: country });
});

// ── POST /api/batches/:id/stores — add a store assignment ─────────────────
router.post('/:id/stores', async (req, res) => {
  const { store_id, shopify_tag, product_count, notes } = req.body;

  if (!store_id || !shopify_tag)
    return res.status(400).json({ error: 'store_id and shopify_tag are required' });

  const { data, error } = await supabase
    .from('biq_batch_stores')
    .insert({ batch_id: req.params.id, store_id, shopify_tag, product_count: product_count || 0, notes })
    .select(`
      id, shopify_tag, product_count, notes,
      biq_stores ( id, name, shop_domain, country )
    `)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PATCH /api/batches/:batchId/stores/:bsId — update store assignment ─────
router.patch('/:batchId/stores/:bsId', async (req, res) => {
  const { shopify_tag, product_count, notes } = req.body;

  const { data, error } = await supabase
    .from('biq_batch_stores')
    .update({ shopify_tag, product_count, notes })
    .eq('id', req.params.bsId)
    .eq('batch_id', req.params.batchId)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/batches/:batchId/stores/:bsId — remove store from batch ────
router.delete('/:batchId/stores/:bsId', async (req, res) => {
  const { error } = await supabase
    .from('biq_batch_stores')
    .delete()
    .eq('id', req.params.bsId)
    .eq('batch_id', req.params.batchId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

module.exports = router;
