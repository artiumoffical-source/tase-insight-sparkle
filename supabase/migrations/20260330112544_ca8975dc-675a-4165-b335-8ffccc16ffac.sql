
CREATE TABLE public.news_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
  original_title text NOT NULL DEFAULT '',
  original_url text NOT NULL DEFAULT '',
  original_source text NOT NULL DEFAULT '',
  original_date timestamp with time zone,
  related_ticker text,
  ai_title_he text NOT NULL DEFAULT '',
  ai_body_he text NOT NULL DEFAULT '',
  ai_summary_he text NOT NULL DEFAULT '',
  author text NOT NULL DEFAULT 'ארטיום מנדבורה',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  published_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published articles"
  ON public.news_articles
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "Authenticated users can manage articles"
  ON public.news_articles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
