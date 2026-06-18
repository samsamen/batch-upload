const fetch = require('node-fetch');

const GADS_API_VERSION = 'v18';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Exchange the long-lived refresh token for a short-lived access token.
async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Google OAuth failed: ${json.error_description || json.error || res.status}`);
  }
  return json.access_token;
}

// Run a GAQL search query against a customer account. Returns all rows (paginated).
async function searchStream(cfg, accessToken, customerId, gaql) {
  const url = `https://googleads.googleapis.com/${GADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': cfg.gads_developer_token,
    'Content-Type': 'application/json',
  };
  // When the account is under an MCC, login-customer-id must be the MCC id.
  if (cfg.gads_login_customer_id) headers['login-customer-id'] = String(cfg.gads_login_customer_id).replace(/\D/g, '');

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ query: gaql }) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 400)}`);
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Google Ads bad response: ${text.slice(0, 200)}`); }
  // searchStream returns an array of { results: [...] } batches
  const rows = [];
  const batches = Array.isArray(parsed) ? parsed : [parsed];
  for (const b of batches) {
    for (const r of (b.results || [])) rows.push(r);
  }
  return rows;
}

// Get spend per product-id per market(geo) per day for a date range.
// productIds = array of Shopify/GMC product ids (strings).
// Returns: [{ date, market, productId, cost, conversions, conversionValue, clicks, impressions }]
async function getSpendByProductAndGeo(cfg, accessToken, customerId, productIds, fromDate, toDate) {
  if (!productIds || productIds.length === 0) return [];
  const idSet = new Set(productIds.map(String));

  // shopping_performance_view exposes segments.product_item_id and geographic segments.
  // We segment by date + product_item_id + geo country.
  const gaql = `
    SELECT
      segments.date,
      segments.product_item_id,
      segments.geo_target_country,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.clicks,
      metrics.impressions
    FROM shopping_performance_view
    WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
  `;

  const rows = await searchStream(cfg, accessToken, customerId, gaql);
  const out = [];
  for (const r of rows) {
    const seg = r.segments || {};
    const m = r.metrics || {};
    const pid = String(seg.productItemId || '');
    if (!idSet.has(pid)) continue; // only this batch's products
    // geo_target_country comes as a resource name like geoTargetConstants/2056 (Belgium).
    // We map it later; store the raw constant id for now, resolved to country code in resolver.
    const geoRaw = seg.geoTargetCountry || '';
    out.push({
      date: seg.date,
      geoConstant: geoRaw ? String(geoRaw).split('/').pop() : null,
      productId: pid,
      cost: (parseInt(m.costMicros || '0', 10)) / 1e6,
      conversions: parseFloat(m.conversions || '0'),
      conversionValue: parseFloat(m.conversionsValue || '0'),
      clicks: parseInt(m.clicks || '0', 10),
      impressions: parseInt(m.impressions || '0', 10),
    });
  }
  return out;
}

// List accessible customers under the configured credentials (for account picking).
async function listAccessibleCustomers(cfg, accessToken) {
  const url = `https://googleads.googleapis.com/${GADS_API_VERSION}/customers:listAccessibleCustomers`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': cfg.gads_developer_token,
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`listAccessibleCustomers ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  // resourceNames like customers/1234567890
  return (json.resourceNames || []).map(rn => String(rn).split('/').pop());
}

module.exports = {
  getAccessToken,
  searchStream,
  getSpendByProductAndGeo,
  listAccessibleCustomers,
  GADS_API_VERSION,
};
