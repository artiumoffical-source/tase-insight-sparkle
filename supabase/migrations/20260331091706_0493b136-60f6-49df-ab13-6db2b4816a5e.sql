ALTER TABLE public.tase_symbols ADD COLUMN override_name_he text DEFAULT NULL;

-- Update build_search_text to include override_name_he
CREATE OR REPLACE FUNCTION public.build_search_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.search_text := public.normalize_search_text(
    coalesce(NEW.ticker, '') || ' ' ||
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.override_name_he, '') || ' ' ||
    coalesce(NEW.name_he, '') || ' ' ||
    coalesce(NEW.security_id, '')
  );
  RETURN NEW;
END;
$$;