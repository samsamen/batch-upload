-- ============================================================
-- BatchIQ — Full migration. Run this in Supabase SQL Editor.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- Config table for Shopify keys (stored in DB, not Railway)
CREATE TABLE IF NOT EXISTS biq_config (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  shopify_client_id     TEXT,
  shopify_client_secret TEXT,
  app_url               TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO biq_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Stores: feed language + markets
ALTER TABLE biq_stores ADD COLUMN IF NOT EXISTS feed_language TEXT;
ALTER TABLE biq_stores ADD COLUMN IF NOT EXISTS markets JSONB DEFAULT '[]';

-- Batches: tag optional, sub-tags, change tracking
ALTER TABLE biq_batches ALTER COLUMN batch_tag DROP NOT NULL;
ALTER TABLE biq_batches ADD COLUMN IF NOT EXISTS sub_tags JSONB DEFAULT '[]';
ALTER TABLE biq_batches ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '[]';
ALTER TABLE biq_batches ADD COLUMN IF NOT EXISTS changes_note TEXT;
