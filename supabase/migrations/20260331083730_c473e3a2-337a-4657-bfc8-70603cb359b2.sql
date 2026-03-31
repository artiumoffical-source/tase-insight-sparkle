
-- Fix function search paths
ALTER FUNCTION public.normalize_search_text(text) SET search_path = public;
ALTER FUNCTION public.build_search_text() SET search_path = public;
