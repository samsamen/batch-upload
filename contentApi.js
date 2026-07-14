const fetch = require('node-fetch');

// Client Credentials Grant — exchange client_id + client_secret for an access token.
// Works for apps installed on your own stores. No redirect, no login.
// Token is valid 24h, so we fetch fresh each time we need it.
async function getAccessToken(shopDomain, clientId, clientSecret) {
  const url = `https://${shopDomain}/admin/oauth/access_token`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed for ${shopDomain} (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`No access_token returned for ${shopDomain}. Is the app installed on this store?`);
  }
  return data.access_token;
}

module.exports = { getAccessToken };

// Fetch markets (countries) for a store via GraphQL. Requires read_markets scope.
// Returns { markets: ["FI","SE"], error: null } or { markets: [], error: "reason" }.
async function getMarkets(shopDomain, accessToken) {
  const fetch = require('node-fetch');
  // NOTE: do NOT request `enabled` — that field doesn't exist on Market and breaks the whole query.
  const query = `query { markets(first: 50) { nodes { name regions(first: 100) { nodes { ... on MarketRegionCountry { code } } } } } }`;
  try {
    const res = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (json.errors) {
      const msg = Array.isArray(json.errors) ? json.errors.map(e => e.message).join('; ') : JSON.stringify(json.errors);
      return { markets: [], error: msg };
    }
    if (!json.data || !json.data.markets) {
      return { markets: [], error: 'No markets data returned (check read_markets scope on the app).' };
    }
    const codes = new Set();
    for (const m of (json.data.markets.nodes || [])) {
      for (const r of (m.regions?.nodes || [])) {
        if (r && r.code) codes.add(r.code);
      }
    }
    return { markets: [...codes], error: null };
  } catch (err) {
    return { markets: [], error: err.message };
  }
}

module.exports.getMarkets = getMarkets;
