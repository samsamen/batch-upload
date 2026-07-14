// ─────────────────────────────────────────────────────────────────────────────
// Google Content API for Shopping — read products + write custom labels via a
// SUPPLEMENTAL FEED so we never touch the Simprosys primary feed.
//
// One-time manual setup per store (in Merchant Center):
//   Products > Feeds > Supplemental feeds > create one, source = "Content API",
//   then copy its feedId into the store (biq_stores.mc_supplemental_feed_id).
//
// Auth: reuses the per-store Google refresh token, but that token MUST be granted
// the https://www.googleapis.com/auth/content scope (re-authorize once).
// ─────────────────────────────────────────────────────────────────────────────

const BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';

// List ALL products in a Merchant Center account (paginated).
// Returns [{ id, offerId, channel, contentLanguage, feedLabel, targetCountry, title }]
async function listProducts(merchantId, accessToken, maxPages = 40) {
  const out = [];
  let pageToken = null;
  let pages = 0;
  do {
    const url = new URL(`${BASE}/${merchantId}/products`);
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Content API products.list failed: ${json.error?.message || res.status}`);
    }
    for (const p of json.resources || []) {
      out.push({
        id: p.id,
        offerId: p.offerId,
        channel: p.channel,
        contentLanguage: p.contentLanguage,
        feedLabel: p.feedLabel || p.targetCountry,
        targetCountry: p.targetCountry,
        title: p.title,
      });
    }
    pageToken = json.nextPageToken || null;
    pages++;
  } while (pageToken && pages < maxPages);
  return out;
}

// Write a custom label onto a set of products via the supplemental feed.
// products: [{ offerId, channel, contentLanguage, feedLabel }]
// labelIndex: 0-4, labelValue: string
// Returns { updated, errors:[{offerId, message}] }
async function setCustomLabelSupplemental(merchantId, feedId, accessToken, products, labelIndex, labelValue) {
  if (!products.length) return { updated: 0, errors: [] };
  const labelKey = `customLabel${labelIndex}`;
  const entries = products.map((p, i) => ({
    batchId: i + 1,
    merchantId: Number(merchantId),
    method: 'insert',
    feedId: String(feedId),
    product: {
      offerId: p.offerId,
      channel: p.channel || 'online',
      contentLanguage: p.contentLanguage || 'en',
      feedLabel: p.feedLabel,
      [labelKey]: String(labelValue),
    },
  }));

  // Content API allows large batches, but keep chunks reasonable
  const chunks = [];
  for (let i = 0; i < entries.length; i += 200) chunks.push(entries.slice(i, i + 200));

  let updated = 0;
  const errors = [];
  for (const chunk of chunks) {
    const res = await fetch(`${BASE}/products/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: chunk }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Content API products.custombatch failed: ${json.error?.message || res.status}`);
    }
    for (const e of json.entries || []) {
      if (e.errors) errors.push({ batchId: e.batchId, message: e.errors.message || JSON.stringify(e.errors) });
      else updated++;
    }
  }
  return { updated, errors };
}

// Remove the supplemental custom-label data for products (reverts to primary feed).
async function clearCustomLabelSupplemental(merchantId, feedId, accessToken, products) {
  if (!products.length) return { cleared: 0 };
  const entries = products.map((p, i) => ({
    batchId: i + 1,
    merchantId: Number(merchantId),
    method: 'delete',
    feedId: String(feedId),
    productId: p.id, // full REST id online:lang:country:offerId
  }));
  let cleared = 0;
  for (let i = 0; i < entries.length; i += 200) {
    const chunk = entries.slice(i, i + 200);
    const res = await fetch(`${BASE}/products/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: chunk }),
    });
    const json = await res.json();
    if (res.ok) for (const e of json.entries || []) { if (!e.errors) cleared++; }
  }
  return { cleared };
}

module.exports = { listProducts, setCustomLabelSupplemental, clearCustomLabelSupplemental };
