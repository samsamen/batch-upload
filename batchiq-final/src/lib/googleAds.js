const fetch = require('node-fetch');

const GADS_API_VERSION = 'v21';
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
// Returns: [{ date, productId, cost, conversions, conversionValue, clicks, impressions }]
// NOTE: shopping_performance_view PROHIBITS segments.geo_target_country, so this
// query is product-level only (no geo). Per-country spend comes from a separate
// geographic_view query (getSpendByGeo) since the two segments can't be combined.
async function getSpendByProductAndGeo(cfg, accessToken, customerId, productIds, fromDate, toDate) {
  if (!productIds || productIds.length === 0) return [];
  const idSet = new Set(productIds.map(String));

  const gaql = `
    SELECT
      segments.date,
      segments.product_item_id,
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
    out.push({
      date: seg.date,
      geoConstant: null, // not available in this view
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

// Per-country spend via geographic_view (campaign/account level — can't filter by
// product). Returns [{ date, geoConstant, cost, clicks, impressions, conversions, conversionValue }].
// Used to split a batch's spend across markets proportionally.
async function getSpendByGeo(cfg, accessToken, customerId, fromDate, toDate) {
  const gaql = `
    SELECT
      segments.date,
      segments.geo_target_country,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.clicks,
      metrics.impressions
    FROM geographic_view
    WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
  `;
  let rows;
  try { rows = await searchStream(cfg, accessToken, customerId, gaql); }
  catch { return []; } // geo breakdown is best-effort; never block the main sync
  const out = [];
  for (const r of rows) {
    const seg = r.segments || {};
    const m = r.metrics || {};
    const geoRaw = seg.geoTargetCountry || '';
    out.push({
      date: seg.date,
      geoConstant: geoRaw ? String(geoRaw).split('/').pop() : null,
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
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch {
    // Google returned HTML (usually a 404 for a sunset API version, or a auth wall)
    throw new Error(`Google Ads returned a non-JSON response (status ${res.status}). This usually means the API version is wrong or the developer token lacks access. First 120 chars: ${text.slice(0, 120)}`);
  }
  if (!res.ok) {
    const detail = json.error?.message || JSON.stringify(json).slice(0, 300);
    throw new Error(`listAccessibleCustomers ${res.status}: ${detail}`);
  }
  return (json.resourceNames || []).map(rn => String(rn).split('/').pop());
}

// List accounts WITH descriptive names.
// With an MCC: query its customer_client tree (one call, all sub-accounts).
// Without an MCC (individual logins): query each accessible account directly.
async function listAccountsWithNames(cfg, accessToken) {
  const ids = await listAccessibleCustomers(cfg, accessToken);
  const accounts = [];
  const seen = new Set();

  const mcc = cfg.gads_login_customer_id ? String(cfg.gads_login_customer_id).replace(/\D/g, '') : null;

  if (mcc) {
    // MCC path — one query gives names for the whole tree
    try {
      const gaql = `
        SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.currency_code
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'`;
      const rows = await searchStream(cfg, accessToken, mcc, gaql);
      for (const r of rows) {
        const c = r.customerClient || {};
        const id = String(c.id || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        accounts.push({
          id,
          name: c.descriptiveName || `Account ${id}`,
          manager: !!c.manager,
          currency: c.currencyCode || null,
        });
      }
    } catch { /* fall through to per-account lookups */ }
  } else {
    // Individual path — query each accessible account for its own name
    for (const id of ids) {
      if (seen.has(String(id))) continue;
      seen.add(String(id));
      let name = `Account ${id}`, currency = null, manager = false;
      try {
        const gaql = `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1`;
        // Query the account as itself (no login-customer-id header for individual accounts)
        const rows = await searchStream({ ...cfg, gads_login_customer_id: null }, accessToken, id, gaql);
        const c = rows[0]?.customer || {};
        if (c.descriptiveName) name = c.descriptiveName;
        if (c.currencyCode) currency = c.currencyCode;
        manager = !!c.manager;
      } catch { /* keep fallback name */ }
      accounts.push({ id: String(id), name, manager, currency });
    }
  }

  // Add any accessible ids not covered above
  for (const id of ids) {
    if (seen.has(String(id))) continue;
    accounts.push({ id: String(id), name: `Account ${id}`, manager: false, currency: null });
  }
  accounts.sort((a, b) => (a.manager === b.manager ? 0 : a.manager ? 1 : -1));
  return accounts;
}

// Fetch the account's currency code (e.g. 'USD'). Used to convert spend to EUR.
async function getAccountCurrency(cfg, accessToken, customerId) {
  try {
    const gaql = 'SELECT customer.currency_code FROM customer LIMIT 1';
    const useCfg = cfg.gads_login_customer_id ? cfg : { ...cfg, gads_login_customer_id: null };
    const rows = await searchStream(useCfg, accessToken, customerId, gaql);
    return rows[0]?.customer?.currencyCode || null;
  } catch { return null; }
}

module.exports = {
  getAccessToken,
  searchStream,
  getSpendByProductAndGeo,
  getSpendByGeo,
  listAccessibleCustomers,
  listAccountsWithNames,
  getAccountCurrency,
  GADS_API_VERSION,
};
