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
const { syncAll }   = require('./src/routes/sync');

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', time: new Date().toISOString() });
});

app.use('/api/shopify',  shopifyRoutes);
app.use('/api/stores',   storesRoutes);
app.use('/api/batches',  batchesRoutes);
app.use('/api/sync',     syncRoutes);
app.use('/api/config',   configRoutes);

// Serve frontend — built into backend/public during Railway build
const frontendDist = path.join(__dirname, 'public');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

cron.schedule('0 6 * * *', async () => {
  console.log('Cron: daily sync...');
  try { await syncAll(1); } catch (err) { console.error(err.message); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\nBatchIQ running on port ${PORT}\n`);
});
