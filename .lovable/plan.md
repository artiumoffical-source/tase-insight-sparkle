

# Plan: News Pipeline Cleanup + Article & List Page Redesign

## Overview
Three interconnected changes: (1) edge function quality improvements, (2) professional article page redesign, (3) news list page redesign.

---

## Part 1: Edge Function — `generate-news-analysis/index.ts`

### 1A. Relevance Filter
Add `isArticleRelevant(title, content, ticker, companyName)` before processing each article:
- Define sector keyword maps (real estate: נדל"ן, דירות, קבלנים, שוק הדיור; airline: ELAL, תעופה)
- If article content is about real estate but ticker is an airline (or vice versa), return false
- Log `"SKIPPED not relevant"` and `continue`

### 1B. Prompt Improvement
In `buildLockedPrompt`, add to WRITING RULES section:
- `"You ARE the primary source. NEVER mention Globes, Reuters, Bloomberg or any publication. NEVER include '---', 'מקור:', 'Source:', URLs or links anywhere in bodyHe."`

### 1C. Post-generation Sanitization
After parsing AI JSON response, sanitize `parsed.bodyHe`:
- Remove everything after `\n---`
- Filter out lines starting with `מקור:`, `Source:`, or containing `http`

---

## Part 2: Article Page Redesign — `NewsArticlePage.tsx`

Full rewrite to professional Hebrew news layout:

### Layout Structure
1. **Sticky breadcrumb nav** — `חדשות שוק ההון ←` link + share button (top bar)
2. **Title** — `text-3xl sm:text-4xl font-bold`
3. **Summary lead** — styled with `border-r-4 border-primary pr-4` accent
4. **Author bar** — avatar circle with "א", name "ארטיום מנדבורה", role "אנליסט שוק ההון, AlphaMap", date+time
5. **Company hero card** — uses `StockLogo` (lg), company name from `tase_symbols`, ticker.TA badge, link "לדף המניה →"
6. **Body** — split on `\n` into separate `<p>` tags with proper spacing
7. **Share buttons** — WhatsApp, LinkedIn, X, copy link (using native share URLs)
8. **Related articles** — "כתבות נוספות" section, fetch 3 articles with same `related_ticker`
9. **No source URL references** anywhere

### Data Fetching
- Fetch company info from `tase_symbols` by `related_ticker` (name, name_he, logo_url)
- Fetch 3 related articles from `news_articles` where `related_ticker` matches and `status = 'published'`

---

## Part 3: News List Page Redesign — `NewsPage.tsx`

### Layout Structure
1. **Hero article** — first article displayed as large featured card (`rounded-2xl`, full headline + summary, company logo)
2. **Article list** — remaining articles as compact rows with:
   - `StockLogo` (sm), headline, truncated summary (line-clamp-2), timeAgo, author
3. **No external source links**

### Data
- Fetch all unique `related_ticker` values from results
- Batch-fetch company logos from `tase_symbols` for those tickers
- `timeAgo` helper function (e.g. "לפני 3 שעות", "לפני יומיים")

---

## Files Changed
| File | Action |
|------|--------|
| `supabase/functions/generate-news-analysis/index.ts` | Add relevance filter, prompt rules, body sanitization |
| `src/pages/NewsArticlePage.tsx` | Full redesign with hero card, author bar, share, related articles |
| `src/pages/NewsPage.tsx` | Redesign with hero card + list layout, company logos |

