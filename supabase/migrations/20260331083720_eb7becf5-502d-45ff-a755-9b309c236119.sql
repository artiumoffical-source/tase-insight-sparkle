
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add search_text column
ALTER TABLE public.tase_symbols ADD COLUMN IF NOT EXISTS search_text text NOT NULL DEFAULT '';

-- Normalize function
CREATE OR REPLACE FUNCTION public.normalize_search_text(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(t, '[.\-\s\(\)]+', '', 'g'));
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.build_search_text() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_text := public.normalize_search_text(
    coalesce(NEW.ticker, '') || ' ' ||
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.name_he, '') || ' ' ||
    coalesce(NEW.security_id, '')
  );
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_build_search_text ON public.tase_symbols;
CREATE TRIGGER trg_build_search_text
  BEFORE INSERT OR UPDATE ON public.tase_symbols
  FOR EACH ROW EXECUTE FUNCTION public.build_search_text();

-- Backfill
UPDATE public.tase_symbols SET search_text = public.normalize_search_text(
  coalesce(ticker, '') || ' ' || coalesce(name, '') || ' ' || coalesce(name_he, '') || ' ' || coalesce(security_id, '')
);

-- Trigram index
CREATE INDEX IF NOT EXISTS idx_tase_symbols_search_text ON public.tase_symbols USING gin (search_text gin_trgm_ops);
