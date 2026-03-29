CREATE TABLE public.cached_fundamentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cached_fundamentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached fundamentals"
  ON public.cached_fundamentals
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_cached_fundamentals_ticker ON public.cached_fundamentals (ticker);