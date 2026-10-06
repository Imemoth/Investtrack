-- Adds quote-state columns to the investments table.
-- Required for quoteStatus, _refreshedAt, _nativePrice, _nativeCurrency, xtbTicker to survive
-- Supabase round-trips. Without this migration the app falls back gracefully (saves succeed
-- but quote-state is not persisted; all positions reload as "stale" on refresh).
--
-- Apply via: Supabase dashboard → SQL Editor, or `supabase db push`

ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS quote_status     TEXT,
  ADD COLUMN IF NOT EXISTS refreshed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS native_price     NUMERIC,
  ADD COLUMN IF NOT EXISTS native_currency  TEXT,
  ADD COLUMN IF NOT EXISTS xtb_ticker       TEXT;

COMMENT ON COLUMN investments.quote_status    IS 'fresh | stale | missing | unsupported';
COMMENT ON COLUMN investments.refreshed_at    IS 'Timestamp of last successful price fetch';
COMMENT ON COLUMN investments.native_price    IS 'Last fetched price in native currency (e.g. GBX)';
COMMENT ON COLUMN investments.native_currency IS 'Currency of native_price (e.g. GBX for London)';
COMMENT ON COLUMN investments.xtb_ticker      IS 'Original XTB ticker (e.g. ASML.NL) before Yahoo mapping';
