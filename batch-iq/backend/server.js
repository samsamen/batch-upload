require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const shopifyRoutes = require('./src/routes/shopify');
const storesRoutes  = require('./src/routes/stores');
const batchesRoutes = require('./src/routes/batches');
const syncRoutes    = require('./src/routes/sync');
const { syncAll }   = require('./src/routes/sync');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── CORS — allow all origins (Railway, Vercel, localhost) ─────────────────
app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));

// ── Body parsing ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/shopify',  shopifyRoutes);
app.use('/api/stores',   storesRoutes);
app.use('/api/batches',  batchesRoutes);
app.use('/api/sync',     syncRoutes);

// ── Daily cron: 06:00 UTC ─────────────────────────────────────────────────
cron.schedule('0 6 * * *', async () => {
  console.log('Cron: starting daily sync...');
  try { await syncAll(1); }
  catch (err) { console.error('Cron sync error:', err.message); }
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 BatchIQ Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
