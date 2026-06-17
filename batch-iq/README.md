# BatchIQ — Product Intelligence Dashboard

Track product batches across all your Shopify stores. Understand what's working, why, and where to double down.

---

## What it does

- Create **batches** — groups of products you uploaded together, with source, thesis, and validation notes
- Assign batches to **stores** with a Shopify tag
- Daily sync pulls Shopify order data for each batch tag automatically
- See revenue, orders, and units per batch and per store

---

## Deploy

### 1. Supabase — run schema

Go to **Supabase → SQL Editor** and run `supabase/schema.sql`.

Get your **Service Role Key** from Settings → API → service_role (not the anon key).

---

### 2. Backend → Railway

1. Push this repo to GitHub (`samsamen/batch-iq`)
2. Go to **railway.app** → New Project → Deploy from GitHub → select `batch-iq`
3. Set **root directory** to `/backend`
4. Add environment variables (copy from `backend/.env.example`):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SHOPIFY_CLIENT_ID`
   - `SHOPIFY_CLIENT_SECRET`
   - `APP_URL` = your Railway URL (e.g. `https://batch-iq-backend.up.railway.app`)
   - `FRONTEND_URL` = your Vercel URL (e.g. `https://batch-iq.vercel.app`)
5. Generate a domain in Railway → Settings → Networking

---

### 3. Shopify Partners App (one-time setup)

1. Go to **partners.shopify.com** → Apps → Create app → Custom app
2. Set **App URL**: `https://batch-iq-backend.up.railway.app`
3. Set **Redirect URL**: `https://batch-iq-backend.up.railway.app/api/shopify/callback`
4. Required scopes: `read_orders, read_products`
5. Copy **Client ID** and **Client Secret** → add to Railway env vars

You use this **one app** to connect all your stores. Each store just goes through the OAuth once.

---

### 4. Frontend → Vercel

1. Go to **vercel.com** → New Project → Import from GitHub → select `batch-iq`
2. Set **root directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` = your Railway backend URL
4. Deploy

---

## How to use

### Connect stores
1. Go to **Stores** → Connect a store → enter `yourstore.myshopify.com`
2. Approve access in Shopify → you're back on the stores page

### Create a batch
1. Click **+ New Batch** on the Dashboard
2. Fill in: name, source, thesis, validation, tags
3. Batch code is auto-generated (e.g. `B2606-A`)

### Link a batch to a store
1. Open the batch → **+ Add Store**
2. Select store, enter the Shopify tag (e.g. `biq-b2606-a`)
3. Go to Shopify admin → tag all relevant products with that exact tag

### Sync data
- Automatic: every day at 06:00 UTC
- Manual: click **🔄 Sync now** on Dashboard, or the sync button per store row in Batch Detail

---

## Phase 2: Google Ads (coming)

The `biq_performance_daily` table already has columns for `ad_spend`, `clicks`, `impressions`.

When ready, connect Google Ads by labeling your campaigns with the batch code and pulling data via the Ads API.

---

## Tech stack

| Layer    | Tool          |
|----------|---------------|
| Frontend | React + Vite  |
| Backend  | Node.js + Express |
| Database | Supabase      |
| Hosting  | Vercel (frontend) + Railway (backend) |
| Cron     | node-cron (06:00 UTC daily) |
