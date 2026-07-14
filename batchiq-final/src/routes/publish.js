const supabase = require('../lib/supabase');
const { getDraftProductGidsByTag, publishProducts } = require('../lib/shopifyApi');
const { logActivity } = require('../lib/activity');

// Resolve the tag used to find a batch's products in a given store.
function effectiveTag(bs, batch) {
  return (bs.shopify_tag && bs.shopify_tag.trim())
    || (batch.batch_tag && batch.batch_tag.trim())
    || batch.name
    || null;
}

// Load a batch with its stores (incl. access tokens) for publishing.
async function loadBatchForPublish(batchId) {
  const { data, error } = await supabase.from('biq_batches')
    .select(`id, name, batch_tag, go_live_date, auto_publish, published_at,
      biq_batch_stores ( id, shopify_tag, published_at, published_count,
        biq_stores ( id, name, shop_domain, access_token, active ) )`)
    .eq('id', batchId).single();
  if (error) throw new Error(error.message);
  return data;
}

// Count how many DRAFT products would go live, per store. Read-only.
async function previewPublish(batchId) {
  const batch = await loadBatchForPublish(batchId);
  const stores = [];
  let total = 0;
  for (const bs of batch.biq_batch_stores || []) {
    const store = bs.biq_stores || {};
    const tag = effectiveTag(bs, batch);
    const row = { store: store.name, tag, draft_count: 0 };
    if (!store.access_token || !store.shop_domain) { row.error = 'Store not connected'; stores.push(row); continue; }
    if (!tag) { row.error = 'No tag'; stores.push(row); continue; }
    try {
      const gids = await getDraftProductGidsByTag(store, tag);
      row.draft_count = gids.length;
      total += gids.length;
    } catch (err) { row.error = err.message; }
    stores.push(row);
  }
  return { batch: batch.name, total_draft: total, stores, already_published_at: batch.published_at };
}

// Publish a batch live: set all DRAFT products with the tag to ACTIVE, every store.
async function publishBatch(batchId, { trigger = 'manual' } = {}) {
  const batch = await loadBatchForPublish(batchId);
  const results = [];
  let grandPublished = 0;

  for (const bs of batch.biq_batch_stores || []) {
    const store = bs.biq_stores || {};
    const tag = effectiveTag(bs, batch);
    const row = { store: store.name, published: 0, errors: 0 };
    if (!store.access_token || !store.shop_domain) { row.error = 'Store not connected'; results.push(row); continue; }
    if (!tag) { row.error = 'No tag'; results.push(row); continue; }
    try {
      const gids = await getDraftProductGidsByTag(store, tag);
      if (gids.length === 0) { row.note = 'No draft products (already live?)'; results.push(row); continue; }
      const r = await publishProducts(store, gids);
      row.published = r.published;
      row.errors = r.errors.length;
      if (r.errors.length) row.sample_error = r.errors[0]?.message;
      grandPublished += r.published;
      await supabase.from('biq_batch_stores')
        .update({ published_at: new Date().toISOString(), published_count: r.published })
        .eq('id', bs.id).then(() => {}, () => {});
    } catch (err) {
      row.error = err.message;
    }
    results.push(row);
  }

  await supabase.from('biq_batches').update({ published_at: new Date().toISOString() }).eq('id', batch.id).then(() => {}, () => {});
  await logActivity('publish', grandPublished > 0 ? 'info' : 'warning',
    `${batch.name}: published ${grandPublished} product(s) live (${trigger})`, { results });

  return { batch: batch.name, total_published: grandPublished, results };
}

// Cron: find batches whose go-live date has arrived and auto-publish them once.
async function runScheduledPublishes() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: due, error } = await supabase.from('biq_batches')
    .select('id, name, go_live_date, auto_publish, published_at')
    .not('go_live_date', 'is', null)
    .lte('go_live_date', today)
    .is('published_at', null)
    .eq('auto_publish', true);
  if (error) { console.error('Scheduled publish query failed:', error.message); return; }
  if (!due || due.length === 0) return;

  for (const b of due) {
    try {
      await logActivity('publish', 'info', `${b.name}: go-live date reached (${b.go_live_date}) — auto-publishing`, {});
      await publishBatch(b.id, { trigger: 'scheduled' });
    } catch (err) {
      await logActivity('publish', 'error', `${b.name}: scheduled publish failed`, { error: err.message });
    }
  }
}

module.exports = { previewPublish, publishBatch, runScheduledPublishes };
