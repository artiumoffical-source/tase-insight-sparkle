CREATE TABLE public.financial_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  year text NOT NULL,
  field text NOT NULL,
  value numeric NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticker, year, field)
);

ALTER TABLE public.financial_overrides ENABLE ROW LEVEL SECURITY;