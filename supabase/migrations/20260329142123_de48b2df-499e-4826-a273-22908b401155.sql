CREATE TABLE public.tase_symbols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  name_he text NOT NULL DEFAULT '',
  logo_url text DEFAULT NULL,
  exchange text NOT NULL DEFAULT 'TA',
  type text DEFAULT NULL,
  currency text DEFAULT 'ILS',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tase_symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tase_symbols"
  ON public.tase_symbols
  FOR SELECT
  TO anon, authenticated
  USING (true);