-- Migration: Create urls table with Stage 1 production schema
-- Keeps the table raw-SQL and avoids any clicks counter.

DROP TABLE IF EXISTS urls CASCADE;

CREATE TABLE urls (
  id BIGSERIAL PRIMARY KEY,
  short_code VARCHAR(10) UNIQUE NOT NULL,
  long_url TEXT NOT NULL,
  user_id BIGINT NULL,
  custom_alias BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_urls_short_code ON urls(short_code);

COMMENT ON TABLE urls IS 'URL shortener main table for Stage 1';
COMMENT ON COLUMN urls.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN urls.short_code IS 'Unique short code';
COMMENT ON COLUMN urls.long_url IS 'Original long URL to redirect to';
COMMENT ON COLUMN urls.user_id IS 'Nullable user id reserved for Stage 2';
COMMENT ON COLUMN urls.custom_alias IS 'Whether the short code is user-provided';
COMMENT ON COLUMN urls.is_active IS 'Soft delete flag';
COMMENT ON COLUMN urls.expires_at IS 'Optional expiration timestamp';
COMMENT ON COLUMN urls.created_at IS 'Creation timestamp';
