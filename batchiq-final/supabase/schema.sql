-- ============================================================
-- BatchIQ — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Stores
CREATE TABLE IF NOT EXISTS biq_stores (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain   TEXT NOT NULL UNIQUE,  -- e.g. emiyosuomi.myshopify.com
  name          TEXT NOT NULL,
  access_token  TEXT NOT NULL,
  country       TEXT,
  currency      TEXT DEFAULT 'EUR',
  feed_language TEXT,
  active        BOOLEAN DEFAULT true,
  connected_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Batches
CREATE TABLE IF NOT EXISTS biq_batches (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_code        TEXT NOT NULL UNIQUE,  -- internal code e.g. B2606-A
  batch_tag         TEXT,                  -- Shopify parent tag e.g. "b20" — applied to ALL products in this batch
  name              TEXT NOT NULL,
  source            TEXT,                  -- where you found the products
  thesis            TEXT,                  -- why you think it works
  validation_notes  TEXT,                  -- proof, signals, data
  tags              TEXT[] DEFAULT '{}',   -- e.g. {summer, impulse-buy, fashion}
  status            TEXT DEFAULT 'active', -- active / paused / archived
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, add the column safely:
-- ALTER TABLE biq_batches ADD COLUMN IF NOT EXISTS batch_tag TEXT;

-- Batch ↔ Store assignments
CREATE TABLE IF NOT EXISTS biq_batch_stores (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id      UUID REFERENCES biq_batches(id) ON DELETE CASCADE,
  store_id      UUID REFERENCES biq_stores(id) ON DELETE CASCADE,
  shopify_tag   TEXT NOT NULL,       -- store sub-tag e.g. "b20-fi" — products also carry the parent batch_tag
  product_count INTEGER DEFAULT 0,   -- how many products you tagged (manual)
  notes         TEXT,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, store_id)
);

-- Daily performance snapshots (pulled from Shopify)
CREATE TABLE IF NOT EXISTS biq_performance_daily (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_store_id  UUID REFERENCES biq_batch_stores(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  orders          INTEGER DEFAULT 0,
  revenue         DECIMAL(10,2) DEFAULT 0,
  units_sold      INTEGER DEFAULT 0,
  -- Phase 2: Google Ads (leave NULL until connected)
  ad_spend        DECIMAL(10,2),
  clicks          INTEGER,
  impressions     INTEGER,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_store_id, date)
);

-- Sync log (track when syncs ran and any errors)
CREATE TABLE IF NOT EXISTS biq_sync_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      UUID REFERENCES biq_stores(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  days_synced   INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'running',  -- running / success / error
  error_message TEXT
);

-- App config — Shopify keys stored here instead of Railway env vars
CREATE TABLE IF NOT EXISTS biq_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  shopify_client_id     TEXT,
  shopify_client_secret TEXT,
  app_url               TEXT,   -- this app's own URL (for OAuth redirect)
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single config row
INSERT INTO biq_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
