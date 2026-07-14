const supabase = require('../lib/supabase');
const { getProductsByTag, listProductTags } = require('../lib/shopifyApi');
const { logActivity } = require('../lib/activity');
const { getConfig } = require('./config');

// Does a tag match the configured batch-detection rule?
// pattern supports a comma-separated list ("BATCH, PARTIJ") and "*" = all tags.
function tagMatchesRule(tag, match, pattern) {
  if (!tag || !pattern) return false;
  const t = String(tag).toLowerCase();
  const patterns = String(pattern).split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
  for (const p of patterns) {
    if (p === '*') return true;
    if (match === 'startswith' ? t.startsWith(p) : match === 'exact' ? t === p : t.includes(p)) return true;
  }
  return false;
}

async function getRule() {
  const cfg = await getConfig();
  return {
    match: cfg.batch_tag_match || 'contains',
    pattern: cfg.batch_tag_pattern || 'BATCH',
    mode: cfg.batch_link_mode || 'per_store',
  };
}

// Link a batch to every active store that has products with its tag.
// Creates/updates biq_batch_stores rows with product counts. Reusable.
async function autoLinkBatch(batchId) {
  const { data: batch } = await supabase.from('biq_batches')
    .select('id, name, batch_tag').eq('id', batchId).single();
  if (!batch) throw new Error('Batch not found');
  const tag = (batch.batch_tag && batch.batch_tag.trim()) || batch.name;
  if (!tag) throw new Error('Batch has no tag/name to match on');

  const { data: stores } = await supabase.from('biq_stores')
    .select('id, name, shop_domain, access_token, active').eq('active', true);

  const linked = [];
  for (const store of stores || []) {
    if (!store.access_token || !store.shop_domain) continue;
    try {
      const ids = await getProductsByTag(store, tag);
      if (ids.length === 0) continue;
      const sc = ids.statusCounts || { active: 0, draft: 0, archived: 0 };
      // Upsert the link (unique on batch_id + store_id)
      const { data: existing } = await supabase.from('biq_batch_stores')
        .select('id').eq('batch_id', batchId).eq('store_id', store.id).maybeSingle();
      const payload = {
        batch_id: batchId, store_id: store.id, shopify_tag: tag,
        product_count: ids.length, product_count_active: sc.active,
        product_count_draft: sc.draft, product_count_archived: sc.archived,
      };
      if (existing) await supabase.from('biq_batch_stores').update(payload).eq('id', existing.id);
      else await supabase.from('biq_batch_stores').insert(payload);
      linked.push({ store: store.name, products: ids.length, active: sc.active, draft: sc.draft });
    } catch (err) {
      linked.push({ store: store.name, error: err.message });
    }
  }
  await logActivity('link', 'info', `${batch.name}: auto-linked ${linked.filter(l => !l.error).length} store(s) by tag "${tag}"`, { linked });
  return { tag, linked };
}

// Scan every active store's tags, keep those matching the rule. Returns BOTH
// shapes: grouped (same tag across stores = one proposal) and per_store (each
// store+tag = its own proposal). Read-only — proposes, doesn't create.
async function discoverBatches() {
  const rule = await getRule();
  const { data: stores } = await supabase.from('biq_stores')
    .select('id, name, shop_domain, access_token, active').eq('active', true);

  // Known batches incl. their linked stores → per-store existence check
  const { data: known } = await supabase.from('biq_batches')
    .select('id, batch_tag, name, biq_batch_stores ( store_id )');
  const knownTags = new Set((known || []).flatMap(b => [b.batch_tag, b.name].filter(Boolean).map(s => s.toLowerCase())));
  const knownPairs = new Set();
  for (const b of known || []) {
    for (const l of b.biq_batch_stores || []) {
      for (const key of [b.batch_tag, b.name]) {
        if (key) knownPairs.add(`${key.toLowerCase()}|${l.store_id}`);
      }
    }
  }

  const byTag = {};       // grouped: tag -> { tag, stores: [] }
  const perStore = [];    // flat: { tag, store_id, store, already_exists }
  const scanned = [];
  for (const store of stores || []) {
    if (!store.access_token || !store.shop_domain) { scanned.push({ store: store.name, error: 'not connected' }); continue; }
    try {
      const tags = await listProductTags(store);
      const matches = tags.filter(t => tagMatchesRule(t, rule.match, rule.pattern));
      for (const tag of matches) {
        if (!byTag[tag]) byTag[tag] = { tag, already_exists: knownTags.has(tag.toLowerCase()), stores: [] };
        byTag[tag].stores.push({ store_id: store.id, store: store.name });
        perStore.push({
          tag, store_id: store.id, store: store.name,
          already_exists: knownPairs.has(`${tag.toLowerCase()}|${store.id}`),
        });
      }
      scanned.push({ store: store.name, tags_total: tags.length, matched: matches.length });
    } catch (err) {
      scanned.push({ store: store.name, error: err.message });
    }
  }

  const proposals = Object.values(byTag).sort((a, b) => a.tag.localeCompare(b.tag));
  perStore.sort((a, b) => a.store.localeCompare(b.store) || a.tag.localeCompare(b.tag));
  return { rule, scanned, proposals, proposals_per_store: perStore };
}

// Create batches from a list of tags (from discovery) + auto-link their stores.
async function createBatchesFromTags(tags) {
  const created = [];
  for (const tag of tags) {
    // Skip if a batch with this tag/name already exists
    const { data: existing } = await supabase.from('biq_batches')
      .select('id').or(`batch_tag.eq.${tag},name.eq.${tag}`).maybeSingle();
    let batchId;
    if (existing) { batchId = existing.id; }
    else {
      const { data: nb, error } = await supabase.from('biq_batches')
        .insert({ name: tag, batch_tag: tag, status: 'active', stage: 'draft' })
        .select('id').single();
      if (error) { created.push({ tag, error: error.message }); continue; }
      batchId = nb.id;
    }
    try {
      const r = await autoLinkBatch(batchId);
      created.push({ tag, batch_id: batchId, linked_stores: r.linked.filter(l => !l.error).length });
    } catch (err) {
      created.push({ tag, batch_id: batchId, error: err.message });
    }
  }
  return { created };
}

// Create batches per-store: each item { tag, store_id, store } becomes its OWN
// batch named "TAG — STORE", linked to only that store (with product counts).
async function createBatchesPerStore(items) {
  const created = [];
  for (const it of items) {
    if (!it.tag || !it.store_id) { created.push({ ...it, error: 'tag and store_id required' }); continue; }
    const { data: store } = await supabase.from('biq_stores')
      .select('id, name, shop_domain, access_token').eq('id', it.store_id).single();
    if (!store) { created.push({ ...it, error: 'Store not found' }); continue; }

    const name = `${it.tag} — ${store.name}`;
    // Reuse an existing batch with this exact name, else create
    const { data: ex } = await supabase.from('biq_batches').select('id').eq('name', name).maybeSingle();
    let batchId = ex?.id;
    if (!batchId) {
      const { data: nb, error } = await supabase.from('biq_batches')
        .insert({ name, batch_tag: it.tag, status: 'active', stage: 'draft' })
        .select('id').single();
      if (error) { created.push({ tag: it.tag, store: store.name, error: error.message }); continue; }
      batchId = nb.id;
    }

    try {
      const ids = await getProductsByTag(store, it.tag);
      const sc = ids.statusCounts || { active: 0, draft: 0, archived: 0 };
      const { data: existing } = await supabase.from('biq_batch_stores')
        .select('id').eq('batch_id', batchId).eq('store_id', store.id).maybeSingle();
      const payload = {
        batch_id: batchId, store_id: store.id, shopify_tag: it.tag,
        product_count: ids.length, product_count_active: sc.active,
        product_count_draft: sc.draft, product_count_archived: sc.archived,
      };
      if (existing) await supabase.from('biq_batch_stores').update(payload).eq('id', existing.id);
      else await supabase.from('biq_batch_stores').insert(payload);
      created.push({ tag: it.tag, store: store.name, batch_id: batchId, products: ids.length });
    } catch (err) {
      created.push({ tag: it.tag, store: store.name, batch_id: batchId, error: err.message });
    }
  }
  await logActivity('link', 'info', `Per-store discovery: created/linked ${created.filter(c => !c.error).length} batch(es)`, { created });
  return { created };
}

// Cron: run discovery with the saved rule + mode, create anything new, once daily.
// Returns the number of batches created (0 = nothing new, no writes happen).
async function runAutoDiscovery() {
  const cfg = await getConfig();
  if (!cfg.auto_discover) return { skipped: true, created: 0 };

  const scan = await discoverBatches();
  let createdCount = 0;

  if ((cfg.batch_link_mode || 'per_store') === 'per_store') {
    const items = (scan.proposals_per_store || [])
      .filter(p => !p.already_exists)
      .map(p => ({ tag: p.tag, store_id: p.store_id }));
    if (items.length > 0) {
      const r = await createBatchesPerStore(items);
      createdCount = (r.created || []).filter(c => !c.error).length;
    }
  } else {
    const tags = (scan.proposals || []).filter(p => !p.already_exists).map(p => p.tag);
    if (tags.length > 0) {
      const r = await createBatchesFromTags(tags);
      createdCount = (r.created || []).filter(c => !c.error).length;
    }
  }

  if (createdCount > 0) {
    await logActivity('link', 'success', `Auto-discovery: ${createdCount} new batch(es) created from store tags`, {});
  }
  return { skipped: false, created: createdCount };
}

module.exports = { tagMatchesRule, autoLinkBatch, discoverBatches, createBatchesFromTags, createBatchesPerStore, runAutoDiscovery };
