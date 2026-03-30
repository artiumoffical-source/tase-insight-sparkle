UPDATE public.news_articles SET status = 'rejected' WHERE status = 'pending';
UPDATE public.news_articles SET status = 'rejected' WHERE original_title LIKE '%NewMed%' AND status = 'published';