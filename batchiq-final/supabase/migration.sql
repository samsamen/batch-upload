-- ============================================================
-- BatchIQ — Migration: run this if you already created tables
-- before the "no-login connect" update. Safe to run multiple times.
-- ============================================================

-- 1. Config table for Shopify keys (stored in DB, not Railway)
CREATE TABLE IF NOT EXISTS biq_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  shopify_client_id     TEXT,
  shopify_client_secret TEXT,
  app_url               TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO biq_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. Feed language column on stores
ALTER TABLE biq_stores ADD COLUMN IF NOT EXISTS feed_language TEXT;
