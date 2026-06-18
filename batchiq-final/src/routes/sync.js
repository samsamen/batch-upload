const express = require('express');
const supabase = require('../lib/supabase');
const { getProductsByTag, getOrdersForRange, calcPerformance } = require('../lib/shopifyApi');
const { getAccessToken } = require('../lib/shopifyAuth');
const { getConfig } = require('./config');

const router = express.Router();

// ── Core sync function for one batch_store entry ───────────────────────────
async function syncBatchStore(batchStore, fromDate, toDate) {
  const store = batchStore.biq_stores;
  const { id: bsId, shopify_tag } = batchStore;

  // Refresh access token (client credentials tokens expire after 24h)
  try {
    const cfg = await getConfig();
    if (cfg.shopify_client_id && cfg.shopify_client_secret) {
      store.access_token = await getAccessToken(
        store.shop_domain, cfg.shopify_client_id, cfg.shopify_client_secret
      );
    }
  } catch (err) {
    throw new Error(`Token refresh failed for ${store.shop_domain}: ${err.message}`);
  }

  // 1. Get product IDs with this tag from the store
  let productIds = [];
  try {
    productIds = await getProductsByTag(store, shopify_tag);
  } catch (err) {
    throw new Error(`Failed to get products from ${store.shop_domain}: ${err.message}`);
  }

  if (productIds.length === 0) {
    console.log(`  ⚠️  No products found with tag "${shopify_tag}" on ${store.shop_domain}`);
    return 0;
  }

  // 2. Get paid orders for the date range
  let orders = [];
  try {
    orders = await getOrdersForRange(store, fromDate, toDate);
  } catch (err) {
    throw new Error(`Failed to get orders from ${store.shop_domain}: ${err.message}`);
  }

  // 3. Group orders by date and calculate per-day performance
  const byDate = {};
  for (const order of orders) {
    const date = order.created_at.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(order);
  }

  // 4. Calculate performance and upsert into performance_daily
  let daysUpserted = 0;
  for (const [date, dayOrders] of Object.entries(byDate)) {
    const perf = calcPerformance(productIds, dayOrders);
    if (perf.orders === 0) continue;

    const { error } = await supabase.from('biq_performance_daily').upsert(
      {
        batch_store_id: bsId,
        date,
        orders: perf.orders,
        revenue: perf.revenue,
        units_sold: perf.units,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'batch_store_id,date' }
    );

    if (error) throw new Error(`DB upsert failed for ${date}: ${error.message}`);
    daysUpserted++;
  }

  return daysUpserted;
}

// ── Sync all active batch_stores ───────────────────────────────────────────
async function syncAll(days = 1) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  console.log(`\n🔄 BatchIQ Sync starting — ${fromStr} to ${toStr}`);

  // Get all active batch_stores
  const { data: batchStores, error } = await supabase
    .from('biq_batch_stores')
    .select(`
      id, shopify_tag,
      biq_stores ( id, shop_domain, name, access_token, active ),
      biq_batches ( status )
    `);

  if (error) throw new Error(`Failed to fetch batch_stores: ${error.message}`);

  const active = (batchStores || []).filter(
    (bs) => bs.biq_stores?.active && bs.biq_batches?.status === 'active'
  );

  console.log(`  📦 ${active.length} active batch-store pairs to sync`);

  let totalDays = 0;
  const errors = [];

  for (const bs of active) {
    try {
      console.log(`  → ${bs.biq_stores.name} / tag: ${bs.shopify_tag}`);
      const days = await syncBatchStore(bs, fromStr, toStr);
      totalDays += days;
    } catch (err) {
      console.error(`  ❌ ${err.message}`);
      errors.push(err.message);
    }
  }

  console.log(`✅ Sync complete — ${totalDays} days upserted, ${errors.length} errors\n`);
  return { synced: totalDays, errors };
}

// ── POST /api/sync — manual trigger (syncs last N days) ───────────────────
router.post('/', async (req, res) => {
  const days = parseInt(req.body?.days) || 7;

  try {
    const result = await syncAll(days);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/sync/store/:storeId — sync a single store ───────────────────
router.post('/store/:storeId', async (req, res) => {
  const days = parseInt(req.body?.days) || 7;
  const { storeId } = req.params;

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  const { data: batchStores, error } = await supabase
    .from('biq_batch_stores')
    .select(`
      id, shopify_tag,
      biq_stores ( id, shop_domain, name, access_token, active ),
      biq_batches ( status )
    `)
    .eq('store_id', storeId);

  if (error) return res.status(500).json({ error: error.message });

  let totalDays = 0;
  const errors = [];

  for (const bs of batchStores || []) {
    try {
      const d = await syncBatchStore(bs, fromStr, toStr);
      totalDays += d;
    } catch (err) {
      errors.push(err.message);
    }
  }

  res.json({ success: true, synced: totalDays, errors });
});

// Export syncAll for cron use
module.exports = router;
module.exports.syncAll = syncAll;
