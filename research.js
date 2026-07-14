// Currency conversion to EUR (the portfolio's reporting currency).
// Uses the free, key-less open.er-api.com endpoint, cached for 12h.
// All store revenue (Shopify) and ad spend (Google Ads) get normalized to EUR
// so batch/store/market totals and ROAS are apples-to-apples.

const fetch = require('node-fetch');

let cache = { rates: null, fetchedAt: 0 };
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Hardcoded fallback rates (EUR base) used only if the API is unreachable.
// Conservative recent approximations — better than mixing currencies raw.
const FALLBACK = {
  EUR: 1, USD: 1.08, GBP: 0.85, CAD: 1.47, CHF: 0.96, JPY: 168,
  PLN: 4.30, SEK: 11.3, NOK: 11.6, DKK: 7.46, AUD: 1.64, CZK: 25.2,
  ILS: 4.0, HKD: 8.4,
};

// Returns an object: { EUR: 1, USD: 1.08, ... } meaning 1 EUR = X of that currency
async function getRates() {
  const now = Date.now();
  if (cache.rates && now - cache.fetchedAt < TTL_MS) return cache.rates;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', { timeout: 8000 });
    const json = await res.json();
    if (json && json.result === 'success' && json.rates && json.rates.EUR === 1) {
      cache = { rates: json.rates, fetchedAt: now };
      return json.rates;
    }
    throw new Error('bad rates payload');
  } catch {
    // Keep stale cache if we have one; otherwise use fallback
    if (cache.rates) return cache.rates;
    return FALLBACK;
  }
}

// Convert an amount FROM a given currency INTO EUR.
// rates are EUR-based (1 EUR = rates[CUR] of that currency), so EUR = amount / rate.
async function toEUR(amount, fromCurrency) {
  const cur = (fromCurrency || 'EUR').toUpperCase();
  if (cur === 'EUR') return amount;
  const rates = await getRates();
  const rate = rates[cur];
  if (!rate || rate <= 0) return amount; // unknown currency → leave as-is rather than zero it out
  return amount / rate;
}

// Build a converter bound to one currency (so we fetch rates once per sync).
async function makeConverter(fromCurrency) {
  const cur = (fromCurrency || 'EUR').toUpperCase();
  if (cur === 'EUR') return (amt) => amt;
  const rates = await getRates();
  const rate = rates[cur];
  if (!rate || rate <= 0) return (amt) => amt;
  return (amt) => amt / rate;
}

module.exports = { getRates, toEUR, makeConverter };
