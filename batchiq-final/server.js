require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const path    = require('path');

const shopifyRoutes = require('./src/routes/shopify');
const storesRoutes  = require('./src/routes/stores');
const batchesRoutes = require('./src/routes/batches');
const syncRoutes    = require('./src/routes/sync');
const configRoutes  = require('./src/routes/config');
const researchRoutes = require('./src/routes/research');
const activityRoutes = require('./src/routes/activity');
const googleAdsRoutes = require('./src/routes/googleAds');
const { syncAll }   = require('./src/routes/sync');

const app  = express();
app.set('trust proxy', true);
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BUILD_VERSION = 'v3.3-product-id-match-diag';
const BUILD_TIME = new Date().toISOString();

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: BUILD_VERSION, build_time: BUILD_TIME, time: new Date().toISOString() });
});
app.get('/api/version', (req, res) => {
  res.json({ version: BUILD_VERSION, build_time: BUILD_TIME });
});

app.use('/api/shopify',  shopifyRoutes);
app.use('/api/stores',   storesRoutes);
app.use('/api/batches',  batchesRoutes);
app.use('/api/sync',     syncRoutes);
app.use('/api/config',   configRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/google-ads', googleAdsRoutes);

// Serve frontend — built into backend/public during Railway build
const frontendDist = path.join(__dirname, 'public');
// Serve hashed assets with long cache, but never cache index.html (so a new
// deploy is picked up immediately instead of the browser serving a stale shell).
app.use(express.static(frontendDist, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Auto-sync every 3 hours (syncs last 30 days each time)
cron.schedule('0 */3 * * *', async () => {
  console.log('Cron: auto-sync...');
  try { await syncAll(30); } catch (err) { console.error(err.message); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nBatchIQ running on port ${PORT}\n`);
  // Run one sync shortly after startup so data appears without waiting for cron
  setTimeout(() => { syncAll(30).catch(err => console.error('Startup sync:', err.message)); }, 8000);
});
