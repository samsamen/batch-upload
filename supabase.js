const fetch = require('node-fetch');

const API_VERSION = '2025-01';

// Generic GraphQL request to Shopify Admin API
async function shopifyGraphQL(store, query, variables = {}) {
  const url = `https://${store.shop_domain}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status} for ${store.shop_domain}: ${text.slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors) {
    const msg = Array.isArray(json.errors) ? json.errors.map(e => e.message).join('; ') : JSON.stringify(json.errors);
    throw new Error(`Shopify GraphQL error: ${msg}`);
  }
  return json.data;
}

// Generic GET request to Shopify Admin REST API (kept for shop.json etc.)
async function shopifyGet(store, path) {
  const url = `https://${store.shop_domain}/admin/api/${API_VERSION}${path}`;
  const res = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': store.access_token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status} for ${store.shop_domain}: ${text}`);
  }
  return res.json();
}

// Get ALL product IDs with a specific tag — real server-side tag filter + full pagination.
async function getProductsByTag(store, tag) {
  const ids = [];
  const statusCounts = { active: 0, draft: 0, archived: 0 };
  let cursor = null;
  let hasNext = true;
  const searchQuery = `tag:'${String(tag).replace(/'/g, "\\'")}'`;

  while (hasNext) {
    const query = `
      query($q: String!, $cursor: String) {
        products(first: 250, query: $q, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { id status }
        }
      }`;
    const data = await shopifyGraphQL(store, query, { q: searchQuery, cursor });
    const conn = data.products;
    for (const n of (conn.nodes || [])) {
      ids.push(String(n.id).split('/').pop());
      const st = String(n.status || '').toLowerCase();
      if (st === 'active') statusCounts.active++;
      else if (st === 'draft') statusCounts.draft++;
      else if (st === 'archived') statusCounts.archived++;
    }
    hasNext = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }
  // Attach counts to the array so callers can read both
  ids.statusCounts = statusCounts;
  return ids;
}

// List the shop's product tags (top-level productTags connection, up to 250).
async function listProductTags(store, first = 250) {
  const query = `query($n: Int!) { productTags(first: $n) { edges { node } } }`;
  try {
    const data = await shopifyGraphQL(store, query, { n: first });
    return (data.productTags?.edges || []).map(e => e.node).filter(Boolean);
  } catch (err) {
    // Fallback to the older shop.productTags shape if the top-level isn't available
    try {
      const q2 = `query($n: Int!) { shop { productTags(first: $n) { edges { node } } } }`;
      const d2 = await shopifyGraphQL(store, q2, { n: first });
      return (d2.shop?.productTags?.edges || []).map(e => e.node).filter(Boolean);
    } catch { throw err; }
  }
}
async function getDraftProductGidsByTag(store, tag) {
  const gids = [];
  let cursor = null, hasNext = true;
  const searchQuery = `tag:'${String(tag).replace(/'/g, "\\'")}' status:draft`;
  while (hasNext) {
    const query = `
      query($q: String!, $cursor: String) {
        products(first: 250, query: $q, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { id status }
        }
      }`;
    const data = await shopifyGraphQL(store, query, { q: searchQuery, cursor });
    const conn = data.products;
    for (const n of (conn.nodes || [])) {
      if (String(n.status || '').toLowerCase() === 'draft') gids.push(n.id);
    }
    hasNext = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }
  return gids;
}

// Set products ACTIVE (publish). Returns { published, errors:[] }. Batched to be gentle.
async function publishProducts(store, gids) {
  let published = 0;
  const errors = [];
  for (const gid of gids) {
    const mutation = `
      mutation($input: ProductInput!) {
        productUpdate(input: $input) {
          product { id status }
          userErrors { field message }
        }
      }`;
    try {
      const data = await shopifyGraphQL(store, mutation, { input: { id: gid, status: 'ACTIVE' } });
      const ue = data.productUpdate?.userErrors || [];
      if (ue.length) errors.push({ gid, message: ue[0].message });
      else published++;
    } catch (err) {
      errors.push({ gid, message: err.message });
    }
  }
  return { published, errors };
}

// Get orders for a date range, with line items + product ids, fully paginated.
async function getOrdersForRange(store, fromDate, toDate) {
  const orders = [];
  let cursor = null;
  let hasNext = true;
  const searchQuery = `created_at:>=${fromDate} created_at:<=${toDate}`;

  while (hasNext) {
    const query = `
      query($q: String!, $cursor: String) {
        orders(first: 100, query: $q, after: $cursor, sortKey: CREATED_AT) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            createdAt
            displayFinancialStatus
            shippingAddress { countryCodeV2 }
            billingAddress { countryCodeV2 }
            lineItems(first: 100) {
              nodes {
                quantity
                originalUnitPriceSet { shopMoney { amount } }
                discountedUnitPriceSet { shopMoney { amount } }
                product { id }
              }
            }
          }
        }
      }`;
    const data = await shopifyGraphQL(store, query, { q: searchQuery, cursor });
    const conn = data.orders;
    for (const o of (conn.nodes || [])) {
      const status = (o.displayFinancialStatus || '').toUpperCase();
      if (!['PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED'].includes(status)) continue;
      const line_items = (o.lineItems?.nodes || []).map(li => ({
        quantity: li.quantity,
        price: parseFloat(li.discountedUnitPriceSet?.shopMoney?.amount ?? li.originalUnitPriceSet?.shopMoney?.amount ?? '0'),
        product_id: li.product?.id ? String(li.product.id).split('/').pop() : null,
      }));
      orders.push({
        id: o.id,
        created_at: o.createdAt,
        country: o.shippingAddress?.countryCodeV2 || o.billingAddress?.countryCodeV2 || null,
        line_items,
      });
    }
    hasNext = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }
  return orders;
}

// Calculate performance for a set of product IDs against a list of orders
function calcPerformance(productIds, orders) {
  const productSet = new Set(productIds.map(String));
  let totalOrders = 0, totalRevenue = 0, totalUnits = 0;

  for (const order of orders) {
    const matchingItems = (order.line_items || []).filter(
      (item) => item.product_id && productSet.has(String(item.product_id))
    );
    if (matchingItems.length > 0) {
      totalOrders++;
      for (const item of matchingItems) {
        totalRevenue += (item.price || 0) * (item.quantity || 0);
        totalUnits += (item.quantity || 0);
      }
    }
  }
  return { orders: totalOrders, revenue: totalRevenue, units: totalUnits };
}

module.exports = { shopifyGet, shopifyGraphQL, getProductsByTag, getDraftProductGidsByTag, publishProducts, listProductTags, getOrdersForRange, calcPerformance };
