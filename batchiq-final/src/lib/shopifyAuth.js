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
// Returns array of country codes like ["FI","SE"]. Empty array if scope missing.
async function getMarkets(shopDomain, accessToken) {
  const fetch = require('node-fetch');
  const query = `query { markets(first: 20) { nodes { name enabled regions(first: 50) { nodes { ... on MarketRegionCountry { code } } } } } }`;
  try {
    const res = await fetch(`https://${shopDomain}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (json.errors || !json.data?.markets) return [];
    const codes = new Set();
    for (const m of json.data.markets.nodes) {
      if (m.enabled === false) continue;
      for (const r of (m.regions?.nodes || [])) {
        if (r.code) codes.add(r.code);
      }
    }
    return [...codes];
  } catch {
    return [];
  }
}

module.exports.getMarkets = getMarkets;
