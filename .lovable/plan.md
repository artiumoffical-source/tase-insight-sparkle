

## Plan: Automated AI Newsroom with TASE/MAYA RSS Feed

### What Already Exists
- A `news_articles` table with fields for AI-generated Hebrew content, status workflow (pending/published/rejected), categories, and source metadata.
- An edge function `generate-news-analysis` that fetches news from **EODHD API**, generates AI analysis via Lovable AI, and saves drafts.
- An Admin Newsroom UI at `/admin/newsroom` with edit, publish, reject workflow.

### What Needs to Change

The user wants to **replace EODHD as the news source** with the official **TASE/MAYA RSS feed** (`https://mayaapi.tase.co.il/api/report/rss`) for fetching stock exchange filings directly.

---

### Step 1: Update the `news_articles` Table Schema

Add new columns to support the MAYA-specific data model:

```sql
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS original_headline text DEFAULT '',
  ADD COLUMN IF NOT EXISTS sentiment text DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS content text DEFAULT '';
```

- `original_headline` — raw headline from the MAYA feed
- `sentiment` — AI-determined: 'positive', 'negative', 'neutral'
- `content` — full AI-generated article (longer form, separate from `ai_body_he`)

Map the existing `status` default from `'pending'` to `'draft'` for new articles (existing `pending` articles continue to work).

### Step 2: Create `fetch-tase-news` Edge Function

A new edge function `supabase/functions/fetch-tase-news/index.ts` that:

1. **Fetches the MAYA RSS feed** from `https://mayaapi.tase.co.il/api/report/rss`
2. **Parses XML** using a lightweight Deno XML parser (or regex for RSS `<item>` elements)
3. **For each report item:**
   - Extracts title, link, pubDate, description
   - **Matches company name** against the `tase_symbols` table (fuzzy match using `search_text` column and the existing `normalize_search_text` function)
   - Deduplicates against existing `news_articles.original_url`
4. **Sends each new filing to Lovable AI** with a prompt requesting:
   - A catchy Hebrew title (`ai_title_he`)
   - 3-bullet summary (`ai_summary_he`)
   - Full article (`ai_body_he` / `content`)
   - Sentiment analysis (`sentiment`)
   - Returns JSON
5. **Saves as 'draft'** in `news_articles`

### Step 3: Update `generate-news-analysis` Edge Function

Modify the existing function to **also call** `fetch-tase-news` logic, or add a query parameter (`?source=maya`) so the admin button can trigger MAYA fetching alongside EODHD.

Alternatively, keep them separate and add a second button in the admin UI.

### Step 4: Update Admin Newsroom UI

Enhance `src/pages/AdminNewsroom.tsx`:

- Add a **"Fetch MAYA Filings"** button that triggers the new `fetch-tase-news` function
- Display `original_headline` alongside `ai_title_he` in each card
- Show `sentiment` as a colored badge (green/red/gray)
- Add **"View Source"** button linking to `source_url` (already exists as `original_url` + ExternalLink icon)
- Rename status `'pending'` display to also cover `'draft'`

### Technical Details

**RSS Parsing in Deno:** Use regex-based extraction (`<item>.*?<title>(.*?)</title>.*?<link>(.*?)</link>.*?<pubDate>(.*?)</pubDate>`) since the MAYA RSS is simple XML. No external dependency needed.

**Ticker Matching:** Query `tase_symbols` with normalized search text to match company names from filings to tickers. Use `word_similarity` from pg_trgm for fuzzy matching.

**AI Prompt:** Adapted from existing `STOCK_PROMPT` with additional instruction to extract sentiment as a structured field.

**Files to modify:**
- `supabase/functions/fetch-tase-news/index.ts` — new edge function
- `supabase/functions/generate-news-analysis/index.ts` — minor update to support MAYA source
- `src/pages/AdminNewsroom.tsx` — UI enhancements
- Database migration — add columns

