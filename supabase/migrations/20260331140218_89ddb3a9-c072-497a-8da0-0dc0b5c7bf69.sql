ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS original_headline text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sentiment text DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS content text DEFAULT '';