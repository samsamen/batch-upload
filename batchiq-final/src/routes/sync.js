const express = require('express');
const supabase = require('../lib/supabase');
const { getProductsByTag, getOrdersForRange, calcPerformance } = require('../lib/shopifyApi');
const { getAccessToken } = require('../lib/shopifyAuth');
const { getConfig } = require('./config');
const { logActivity } = require('../lib/activity');

const router = express.Router();

// ── Core sync for one batch_store entry ────────────────────────────────────
async function syncBatchStore(batchStore, fromDate, toDate) {
  const store = batchStore.biq_stores;
  const { id: bsId } = batchStore;

  // KEY FIX: use the store sub-tag if set, otherwise fall back to the batch's parent tag
  const effectiveTag = (batchStore.shopify_tag && batchStore.shopify_tag.trim())
    || (batchStore.biq_batches && batchStore.biq_batches.batch_tag)
    || null;

  const storeName = store?.name || store?.shop_domain || 'store';

  if (!effectiveTag) {
    await logActivity('sync', 'warning', `${storeName}: no tag set on batch or store — skipped`, { batch_store_id: bsId });
    return { days: 0, products: 0 };
  }

  // Refresh access token (client credentials tokens expire after 24h)
  try {
    const cfg = await getConfig();
    if (cfg.shopify_client_id && cfg.shopify_client_secret) {
      store.access_token = await getAccessToken(store.shop_domain, cfg.shopify_client_id, cfg.shopify_client_secret);
    }
  } catch (err) {
    await logActivity('error', 'error', `${storeName}: token refresh failed`, { error: err.message });
    throw new Error(`Token refresh failed for ${store.shop_domain}: ${err.message}`);
  }

  // 1. Get product IDs with the effective tag
  let productIds = [];
  try {
    productIds = await getProductsByTag(store, effectiveTag);
  } catch (err) {
    await logActivity('error', 'error', `${storeName}: product lookup failed (tag "${effectiveTag}")`, { error: err.message });
    throw new Error(`Failed to get products from ${store.shop_domain}: ${err.message}`);
  }

  // Cache the product count on the batch_store
  await supabase.from('biq_batch_stores').update({ product_count: productIds.length }).eq('id', bsId);

  if (productIds.length === 0) {
    await logActivity('sync', 'warning', `${storeName}: 0 products found with tag "${effectiveTag}"`, { batch_store_id: bsId, tag: effectiveTag });
    return { days: 0, products: 0 };
  }

  // 2. Get paid orders
  let orders = [];
  try {
    orders = await getOrdersForRange(store, fromDate, toDate);
  } catch (err) {
    await logActivity('error', 'error', `${storeName}: order lookup failed`, { error: err.message });
    throw new Error(`Failed to get orders from ${store.shop_domain}: ${err.message}`);
  }

  // 3. Group by date
  const byDate = {};
  for (const order of orders) {
    const date = order.created_at.split('T')[0];
    (byDate[date] = byDate[date] || []).push(order);
  }

  // 4. Compute + upsert performance
  let daysUpserted = 0, totalRevenue = 0, totalOrders = 0;
  for (const [date, dayOrders] of Object.entries(byDate)) {
    const perf = calcPerformance(productIds, dayOrders);
    if (perf.orders === 0) continue;
    const { error } = await supabase.from('biq_performance_daily').upsert(
      { batch_store_id: bsId, date, orders: perf.orders, revenue: perf.revenue, units_sold: perf.units, synced_at: new Date().toISOString() },
      { onConflict: 'batch_store_id,date' }
    );
    if (error) throw new Error(`DB upsert failed for ${date}: ${error.message}`);
    daysUpserted++; totalRevenue += perf.revenue; totalOrders += perf.orders;
  }

  await logActivity('sync', 'success',
    `${storeName}: synced ${productIds.length} products, ${totalOrders} orders, €${totalRevenue.toFixed(0)} (tag "${effectiveTag}")`,
    { batch_store_id: bsId, products: productIds.length, orders: totalOrders, revenue: totalRevenue, tag: effectiveTag });

  return { days: daysUpserted, products: productIds.length };
}

// ── Sync all active batch_stores ───────────────────────────────────────────
async function syncAll(days = 1) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  await logActivity('sync', 'info', `Sync started (${days}-day window)`);

  const { data: batchStores, error } = await supabase
    .from('biq_batch_stores')
    .select(`
      id, shopify_tag,
      biq_stores ( id, shop_domain, name, access_token, active ),
      biq_batches ( status, batch_tag )
    `);

  if (error) {
    await logActivity('error', 'error', `Sync failed: ${error.message}`);
    throw new Error(`Failed to fetch batch_stores: ${error.message}`);
  }

  const active = (batchStores || []).filter(bs => bs.biq_stores?.active && bs.biq_batches?.status === 'active');

  let totalDays = 0, totalProducts = 0;
  const errors = [];

  for (const bs of active) {
    try {
      const r = await syncBatchStore(bs, fromStr, toStr);
      totalDays += r.days; totalProducts += r.products;
    } catch (err) {
      errors.push(err.message);
    }
  }

  await logActivity('sync', errors.length ? 'warning' : 'success',
    `Sync complete — ${active.length} links, ${totalDays} days updated${errors.length ? `, ${errors.length} errors` : ''}`);

  return { synced: totalDays, products: totalProducts, links: active.length, errors };
}

// ── POST /api/sync ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const days = parseInt(req.body?.days) || 30;
  try { res.json({ success: true, ...(await syncAll(days)) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/sync/store/:storeId ──────────────────────────────────────────
router.post('/store/:storeId', async (req, res) => {
  const days = parseInt(req.body?.days) || 30;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const { data: batchStores, error } = await supabase
    .from('biq_batch_stores')
    .select(`id, shopify_tag, biq_stores ( id, shop_domain, name, access_token, active ), biq_batches ( status, batch_tag )`)
    .eq('store_id', req.params.storeId);

  if (error) return res.status(500).json({ error: error.message });

  let totalDays = 0; const errors = [];
  for (const bs of batchStores || []) {
    try { const r = await syncBatchStore(bs, fromStr, toStr); totalDays += r.days; }
    catch (err) { errors.push(err.message); }
  }
  res.json({ success: true, synced: totalDays, errors });
});

// ── POST /api/sync/batch/:batchId — sync just one batch ───────────────────
router.post('/batch/:batchId', async (req, res) => {
  const days = parseInt(req.body?.days) || 30;
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const { data: batchStores, error } = await supabase
    .from('biq_batch_stores')
    .select(`id, shopify_tag, biq_stores ( id, shop_domain, name, access_token, active ), biq_batches ( status, batch_tag )`)
    .eq('batch_id', req.params.batchId);

  if (error) return res.status(500).json({ error: error.message });

  let totalDays = 0, totalProducts = 0; const errors = [];
  for (const bs of batchStores || []) {
    try { const r = await syncBatchStore(bs, fromStr, toStr); totalDays += r.days; totalProducts += r.products; }
    catch (err) { errors.push(err.message); }
  }
  res.json({ success: true, synced: totalDays, products: totalProducts, errors });
});

module.exports = router;
module.exports.syncAll = syncAll;
