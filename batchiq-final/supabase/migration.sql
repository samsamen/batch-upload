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

-- Research ideas — kanban brainstorm board
CREATE TABLE IF NOT EXISTS biq_research (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT NOT NULL,
  note          TEXT,
  status        TEXT DEFAULT 'backlog',
  source        TEXT,
  results       TEXT,
  tags          TEXT[] DEFAULT '{}',
  batch_id      UUID REFERENCES biq_batches(id) ON DELETE SET NULL,
  position      INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Sub-tag is optional on batch-store assignments
ALTER TABLE biq_batch_stores ALTER COLUMN shopify_tag DROP NOT NULL;

-- Activity log — track syncs, changes, errors
CREATE TABLE IF NOT EXISTS biq_activity (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type        TEXT NOT NULL,              -- sync / batch / store / error
  level       TEXT DEFAULT 'info',        -- info / success / warning / error
  message     TEXT NOT NULL,
  detail      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON biq_activity (created_at DESC);

-- Product count cache on batch-store links
ALTER TABLE biq_batch_stores ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0;

-- Per-store Shopify app credentials (each store has its own custom app)
ALTER TABLE biq_stores ADD COLUMN IF NOT EXISTS client_id TEXT;
ALTER TABLE biq_stores ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- Per-store product status counts within a batch
ALTER TABLE biq_batch_stores ADD COLUMN IF NOT EXISTS product_count_active INTEGER DEFAULT 0;
ALTER TABLE biq_batch_stores ADD COLUMN IF NOT EXISTS product_count_draft INTEGER DEFAULT 0;
ALTER TABLE biq_batch_stores ADD COLUMN IF NOT EXISTS product_count_archived INTEGER DEFAULT 0;
