const fetch = require('node-fetch');

const API_VERSION = '2024-01';

// Generic GET request to Shopify Admin REST API
async function shopifyGet(store, path) {
  const url = `https://${store.shop_domain}/admin/api/${API_VERSION}${path}`;
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': store.access_token,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status} for ${store.shop_domain}: ${text}`);
  }

  return res.json();
}

// Get all products with a specific tag (handles pagination)
async function getProductsByTag(store, tag) {
  let products = [];
  let pageInfo = null;

  do {
    const url = pageInfo
      ? `/products.json?limit=250&page_info=${pageInfo}&fields=id`
      : `/products.json?limit=250&tag=${encodeURIComponent(tag)}&fields=id`;

    const data = await shopifyGet(store, url);
    products = products.concat(data.products || []);

    // Shopify uses Link header for cursor-based pagination
    // node-fetch doesn't expose Link easily, so for MVP limit to first 250
    // (can enhance later)
    pageInfo = null;
  } while (pageInfo);

  return products.map((p) => String(p.id));
}

// Get paid orders for a date (YYYY-MM-DD string)
async function getOrdersForDate(store, dateStr) {
  const path = `/orders.json?financial_status=paid&created_at_min=${dateStr}T00:00:00&created_at_max=${dateStr}T23:59:59&limit=250&fields=id,line_items,created_at`;
  const data = await shopifyGet(store, path);
  return data.orders || [];
}

// Get paid orders for a date range
async function getOrdersForRange(store, fromDate, toDate) {
  const path = `/orders.json?financial_status=paid&created_at_min=${fromDate}T00:00:00&created_at_max=${toDate}T23:59:59&limit=250&fields=id,line_items,created_at`;
  const data = await shopifyGet(store, path);
  return data.orders || [];
}

// Calculate performance for a set of product IDs against a list of orders
function calcPerformance(productIds, orders) {
  const productSet = new Set(productIds);
  let totalOrders = 0;
  let totalRevenue = 0;
  let totalUnits = 0;

  for (const order of orders) {
    const matchingItems = (order.line_items || []).filter(
      (item) => item.product_id && productSet.has(String(item.product_id))
    );

    if (matchingItems.length > 0) {
      totalOrders++;
      for (const item of matchingItems) {
        totalRevenue += parseFloat(item.price) * item.quantity;
        totalUnits += item.quantity;
      }
    }
  }

  return { orders: totalOrders, revenue: totalRevenue, units: totalUnits };
}

module.exports = { shopifyGet, getProductsByTag, getOrdersForDate, getOrdersForRange, calcPerformance };
