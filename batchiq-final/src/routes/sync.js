const express = require('express');
const supabase = require('../lib/supabase');
const { getProductsByTag, getOrdersForRange, calcPerformance } = require('../lib/shopifyApi');
const { getAccessToken, getMarkets } = require('../lib/shopifyAuth');
const { getConfig } = require('./config');
const { logActivity } = require('../lib/activity');
const gads = require('../lib/googleAds');
const { geoConstantToCode } = require('../lib/geoTargets');
const { makeConverter } = require('../lib/currency');

const router = express.Router();

// ── Fetch + store Google Ads spend per market for a batch_store ────────────
async function syncAdSpend(bsId, store, productIds, fromDate, toDate, marketRevByDate) {
  const cfg = await getConfig();
  // Per-store refresh token + per-store customer id are both required
  if (!store.gads_refresh_token || !store.gads_customer_id) return { spend: 0, markets: 0 };
  if (!cfg.gads_client_id || !cfg.gads_client_secret || !cfg.gads_developer_token) return { spend: 0, markets: 0 };

  let token;
  try {
    token = await gads.getAccessToken(cfg.gads_client_id, cfg.gads_client_secret, store.gads_refresh_token);
  } catch (err) {
    await supabase.from('biq_stores').update({ gads_ok: false, gads_checked_at: new Date().toISOString() }).eq('id', store.id).then(() => {}, () => {});
    await logActivity('ads', 'warning', `${store.name}: Google Ads auth failed`, { error: err.message });
    return { spend: 0, markets: 0 };
  }

  let rows, diag;
  try {
    // Individual mode: when no MCC is configured, query the account as itself
    // (no login-customer-id header). With an MCC, keep using it.
    const queryCfg = cfg.gads_login_customer_id ? cfg : { ...cfg, gads_login_customer_id: null };
    const result = await gads.getSpendByProductAndGeo(queryCfg, token, store.gads_customer_id, productIds, fromDate, toDate);
    rows = result.rows; diag = result.diag;
    // Query succeeded → Google Ads integration is live & healthy
    await supabase.from('biq_stores').update({ gads_ok: true, gads_checked_at: new Date().toISOString() }).eq('id', store.id).then(() => {}, () => {});
  } catch (err) {
    await supabase.from('biq_stores').update({ gads_ok: false, gads_checked_at: new Date().toISOString() }).eq('id', store.id).then(() => {}, () => {});
    await logActivity('ads', 'warning', `${store.name}: Google Ads query failed`, { error: err.message });
    return { spend: 0, markets: 0 };
  }

  // Diagnostics: if the account HAS spend but none matched this batch's products,
  // surface it so you can see the ID-format mismatch instead of a silent €0.
  if (diag && diag.matched_rows === 0 && diag.total_spend_all_products > 0) {
    await logActivity('ads', 'warning',
      `${store.name}: account has €${diag.total_spend_all_products} spend but 0 matched this batch's products — likely a product-ID format mismatch`,
      { diag });
  } else if (diag) {
    await logActivity('ads', 'info',
      `${store.name}: Google Ads matched ${diag.matched_rows} rows, €${diag.matched_spend} spend (account total €${diag.total_spend_all_products})`,
      { diag });
  }

  // Google Ads spend comes in the account's currency → convert to EUR
  let adCur = null;
  try { adCur = await gads.getAccountCurrency(cfg.gads_login_customer_id ? cfg : { ...cfg, gads_login_customer_id: null }, token, store.gads_customer_id); } catch {}
  const adToEur = await makeConverter(adCur || store.currency || 'EUR');

  const queryCfg = cfg.gads_login_customer_id ? cfg : { ...cfg, gads_login_customer_id: null };

  // rows = product-level spend (this batch's products), per date. No geo in this view.
  // To get per-market spend, fetch the account's geo split per date and apportion
  // each day's product spend across markets by that day's geo cost share.
  let geoRows = [];
  try { geoRows = await gads.getSpendByGeo(queryCfg, token, store.gads_customer_id, fromDate, toDate); } catch {}

  // Build per-date geo cost shares from geographic_view: { date: { GB: 0.5, US: 0.5 } }
  const geoByDate = {};
  let geoTotalAll = 0;
  for (const g of geoRows) {
    const market = geoConstantToCode(g.geoConstant) || null;
    if (!market) continue; // skip unmapped geos rather than dumping into ALL
    if (!geoByDate[g.date]) geoByDate[g.date] = { total: 0, byMarket: {} };
    geoByDate[g.date].total += g.cost;
    geoByDate[g.date].byMarket[market] = (geoByDate[g.date].byMarket[market] || 0) + g.cost;
    geoTotalAll += g.cost;
  }

  // Sum this batch's product spend per date (EUR)
  const prodByDate = {}; // date -> { cost, conversions, conversion_value, clicks, impressions }
  for (const r of rows) {
    if (!prodByDate[r.date]) prodByDate[r.date] = { cost: 0, conversions: 0, conversion_value: 0, clicks: 0, impressions: 0 };
    prodByDate[r.date].cost += adToEur(r.cost);
    prodByDate[r.date].conversions += r.conversions;
    prodByDate[r.date].conversion_value += adToEur(r.conversionValue);
    prodByDate[r.date].clicks += r.clicks;
    prodByDate[r.date].impressions += r.impressions;
  }

  // Fallback split: if geographic_view gave us nothing usable, split spend across
  // the markets where this batch actually made REVENUE (we know those per date).
  // revByDateMarket is passed in from the caller (Shopify orders per country).
  const revShareByDate = {};
  if (geoTotalAll === 0 && marketRevByDate) {
    for (const [date, byMkt] of Object.entries(marketRevByDate)) {
      const total = Object.values(byMkt).reduce((s, v) => s + v, 0);
      if (total > 0) {
        revShareByDate[date] = {};
        for (const [mkt, v] of Object.entries(byMkt)) revShareByDate[date][mkt] = v / total;
      }
    }
  }

  // Apportion each date's product spend across markets
  const agg = {}; // key date|market
  for (const [date, p] of Object.entries(prodByDate)) {
    const geo = geoByDate[date];
    let splits;
    if (geo && geo.total > 0) {
      // Best: real geo cost share from Google
      splits = Object.entries(geo.byMarket).map(([market, cost]) => ({ market, frac: cost / geo.total }));
    } else if (revShareByDate[date]) {
      // Fallback: split by where revenue happened that day
      splits = Object.entries(revShareByDate[date]).map(([market, frac]) => ({ market, frac }));
    } else {
      splits = [{ market: 'ALL', frac: 1 }];
    }
    for (const { market, frac } of splits) {
      const key = `${date}|${market}`;
      if (!agg[key]) agg[key] = { date, market, cost: 0, conversions: 0, conversion_value: 0, clicks: 0, impressions: 0 };
      agg[key].cost += p.cost * frac;
      agg[key].conversions += p.conversions * frac;
      agg[key].conversion_value += p.conversion_value * frac;
      agg[key].clicks += Math.round(p.clicks * frac);
      agg[key].impressions += Math.round(p.impressions * frac);
    }
  }

  const upserts = Object.values(agg).map(a => ({ batch_store_id: bsId, ...a, synced_at: new Date().toISOString() }));
  let totalSpend = 0;
  const marketSet = new Set();
  if (upserts.length > 0) {
    for (const u of upserts) { totalSpend += u.cost; marketSet.add(u.market); }
    const { error } = await supabase.from('biq_ad_spend_daily').upsert(upserts, { onConflict: 'batch_store_id,date,market' });
    if (error) await logActivity('ads', 'warning', `${store.name}: ad spend store failed`, { error: error.message });
  }
  return { spend: totalSpend, markets: marketSet.size };
}

// ── Core sync for one batch_store entry ────────────────────────────────────
async function syncBatchStore(batchStore, fromDate, toDate) {
  const store = batchStore.biq_stores;
  const { id: bsId } = batchStore;

  // KEY FIX: tag priority is sub-tag → batch_tag → batch NAME (the name IS the tag on the products)
  const effectiveTag = (batchStore.shopify_tag && batchStore.shopify_tag.trim())
    || (batchStore.biq_batches && batchStore.biq_batches.batch_tag)
    || (batchStore.biq_batches && batchStore.biq_batches.name)
    || null;

  const storeName = store?.name || store?.shop_domain || 'store';

  if (!effectiveTag) {
    await logActivity('sync', 'warning', `${storeName}: batch has no name or tag — cannot find products`, { batch_store_id: bsId });
    return { days: 0, products: 0 };
  }

  // Refresh access token using THIS store's own app keys (client credentials expire after 24h)
  try {
    if (store.client_id && store.client_secret) {
      store.access_token = await getAccessToken(store.shop_domain, store.client_id, store.client_secret);
    }
    // Token refresh worked → Shopify integration is live & healthy
    await supabase.from('biq_stores').update({
      shopify_ok: true, shopify_checked_at: new Date().toISOString(), access_token: store.access_token,
    }).eq('id', store.id);
  } catch (err) {
    await supabase.from('biq_stores').update({
      shopify_ok: false, shopify_checked_at: new Date().toISOString(),
    }).eq('id', store.id).then(() => {}, () => {});
    await logActivity('error', 'error', `${storeName}: token refresh failed`, { error: err.message });
    throw new Error(`Token refresh failed for ${store.shop_domain}: ${err.message}`);
  }

  // Refresh markets (countries) from Shopify and store them
  try {
    const { markets, error: mErr } = await getMarkets(store.shop_domain, store.access_token);
    if (markets.length > 0) {
      await supabase.from('biq_stores').update({ markets }).eq('id', store.id);
    } else if (mErr) {
      await logActivity('store', 'warning', `${storeName}: could not read markets — ${mErr}`, { store_id: store.id });
    }
  } catch { /* markets are best-effort, never block the sync */ }

  // 1. Get product IDs with the effective tag
  let productIds = [];
  try {
    productIds = await getProductsByTag(store, effectiveTag);
  } catch (err) {
    await logActivity('error', 'error', `${storeName}: product lookup failed (tag "${effectiveTag}")`, { error: err.message });
    throw new Error(`Failed to get products from ${store.shop_domain}: ${err.message}`);
  }

  // Cache the product count + per-status counts on the batch_store
  const sc = productIds.statusCounts || { active: 0, draft: 0, archived: 0 };
  await supabase.from('biq_batch_stores').update({
    product_count: productIds.length,
    product_count_active: sc.active,
    product_count_draft: sc.draft,
    product_count_archived: sc.archived,
  }).eq('id', bsId);

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

  // Currency converter: Shopify revenue comes in the store's currency → convert to EUR
  const toEur = await makeConverter(store.currency || 'EUR');

  // 4. Compute + upsert performance
  let daysUpserted = 0, totalRevenue = 0, totalOrders = 0;
  for (const [date, dayOrders] of Object.entries(byDate)) {
    const perf = calcPerformance(productIds, dayOrders);
    if (perf.orders === 0) continue;
    const revenueEur = toEur(perf.revenue);
    const { error } = await supabase.from('biq_performance_daily').upsert(
      { batch_store_id: bsId, date, orders: perf.orders, revenue: revenueEur, units_sold: perf.units, synced_at: new Date().toISOString() },
      { onConflict: 'batch_store_id,date' }
    );
    if (error) throw new Error(`DB upsert failed for ${date}: ${error.message}`);
    daysUpserted++; totalRevenue += revenueEur; totalOrders += perf.orders;
  }

  // 5. Per-market revenue (group orders by date + country, only batch products)
  const marketAgg = {}; // date|country
  for (const order of orders) {
    const date = order.created_at.split('T')[0];
    const market = order.country || 'ALL';
    const perf = calcPerformance(productIds, [order]);
    if (perf.orders === 0) continue;
    const key = `${date}|${market}`;
    if (!marketAgg[key]) marketAgg[key] = { date, market, revenue: 0, orders: 0, units: 0 };
    marketAgg[key].revenue += toEur(perf.revenue);
    marketAgg[key].orders += perf.orders;
    marketAgg[key].units += perf.units;
  }
  const marketUpserts = Object.values(marketAgg).map(m => ({ batch_store_id: bsId, ...m, synced_at: new Date().toISOString() }));
  if (marketUpserts.length > 0) {
    const { error: mErr } = await supabase.from('biq_market_perf_daily').upsert(marketUpserts, { onConflict: 'batch_store_id,date,market' });
    if (mErr) await logActivity('sync', 'warning', `${storeName}: market revenue store failed`, { error: mErr.message });
  }

  // Build revenue-per-date-per-market map (used as fallback to split ad spend by geo)
  const marketRevByDate = {};
  for (const m of Object.values(marketAgg)) {
    if (!m.market || m.market === 'ALL') continue;
    if (!marketRevByDate[m.date]) marketRevByDate[m.date] = {};
    marketRevByDate[m.date][m.market] = (marketRevByDate[m.date][m.market] || 0) + m.revenue;
  }

  // 6. Google Ads spend per market (only if this store has an account + GAds is connected)
  let adResult = { spend: 0, markets: 0 };
  try {
    adResult = await syncAdSpend(bsId, store, productIds, fromDate, toDate, marketRevByDate);
  } catch (err) {
    await logActivity('ads', 'warning', `${storeName}: ad spend sync error`, { error: err.message });
  }

  const roas = adResult.spend > 0 ? (totalRevenue / adResult.spend) : null;
  await logActivity('sync', 'success',
    `${storeName}: ${productIds.length} products (${sc.active} active, ${sc.draft} draft, ${sc.archived} archived), ${totalOrders} orders, €${totalRevenue.toFixed(0)} rev, €${adResult.spend.toFixed(0)} ads${roas !== null ? `, ROAS ${roas.toFixed(2)}` : ''} (tag "${effectiveTag}")`,
    { batch_store_id: bsId, products: productIds.length, status: sc, orders: totalOrders, revenue: totalRevenue, spend: adResult.spend, roas, tag: effectiveTag });

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
      biq_stores ( id, shop_domain, name, access_token, active, client_id, client_secret, gads_customer_id, gads_refresh_token ),
      biq_batches ( status, batch_tag, name )
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
  try {
    const r = await syncStoreNow(req.params.storeId, days);
    res.json({ success: true, ...r });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    .select(`id, shopify_tag, biq_stores ( id, shop_domain, name, access_token, active, client_id, client_secret, gads_customer_id, gads_refresh_token ), biq_batches ( status, batch_tag, name )`)
    .eq('batch_id', req.params.batchId);

  if (error) return res.status(500).json({ error: error.message });

  let totalDays = 0, totalProducts = 0; const errors = [];
  for (const bs of batchStores || []) {
    try { const r = await syncBatchStore(bs, fromStr, toStr); totalDays += r.days; totalProducts += r.products; }
    catch (err) { errors.push(err.message); }
  }
  res.json({ success: true, synced: totalDays, products: totalProducts, errors });
});

// Reusable: sync one store now (markets + all its batch performance)
async function syncStoreNow(storeId, days = 30) {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString().split('T')[0];
  const toStr = toDate.toISOString().split('T')[0];

  // Always refresh markets for the store, even if it has no batches yet
  try {
    const { data: store } = await supabase
      .from('biq_stores').select('id, shop_domain, name, access_token, client_id, client_secret').eq('id', storeId).single();
    if (store) {
      let token = store.access_token;
      if (store.client_id && store.client_secret) {
        try { token = await getAccessToken(store.shop_domain, store.client_id, store.client_secret); } catch {}
      }
      const { markets, error: mErr } = await getMarkets(store.shop_domain, token);
      if (markets.length > 0) {
        await supabase.from('biq_stores').update({ markets }).eq('id', storeId);
        await logActivity('store', 'success', `${store.name}: markets refreshed — ${markets.join(', ')}`);
      } else if (mErr) {
        await logActivity('store', 'warning', `${store.name}: could not read markets — ${mErr}`, { store_id: storeId });
      } else {
        await logActivity('store', 'info', `${store.name}: no markets configured in Shopify`);
      }
    }
  } catch (err) {
    await logActivity('store', 'warning', `Market refresh failed for store`, { error: err.message });
  }

  // Sync performance for every batch linked to this store
  const { data: batchStores } = await supabase
    .from('biq_batch_stores')
    .select(`id, shopify_tag, biq_stores ( id, shop_domain, name, access_token, active, client_id, client_secret, gads_customer_id, gads_refresh_token ), biq_batches ( status, batch_tag, name )`)
    .eq('store_id', storeId);

  let totalDays = 0; const errors = [];
  for (const bs of batchStores || []) {
    try { const r = await syncBatchStore(bs, fromStr, toStr); totalDays += r.days; }
    catch (err) { errors.push(err.message); }
  }
  return { synced: totalDays, errors };
}

module.exports = router;
module.exports.syncAll = syncAll;
module.exports.syncStoreNow = syncStoreNow;
