

# Full TASE Coverage & Dynamic Stock Ingestion

## Overview
Transform AlphaMap from a limited stock list to a complete Tel Aviv Stock Exchange terminal by: (1) syncing ALL TASE securities from EODHD, (2) adding on-the-fly ticker ingestion when users search for unknown stocks, and (3) ensuring all stocks get full financial data regardless of size.

## Plan

### 1. Upgrade sync-tase-symbols Edge Function
- Remove the 7-day cache check (or make it configurable via query param `?force=true`)
- Keep fetching from `exchange-symbol-list/TA` which already returns ALL TASE securities
- The current function already does this correctly — the issue is it may not have been triggered recently
- Add a secondary pass: for any row with empty `name_he`, attempt to extract Hebrew name from the EODHD `Name` field or leave blank for manual mapping later
- Add logging for total count of symbols upserted

### 2. Create "resolve-ticker" Edge Function (Dynamic Ingestion)
New edge function `supabase/functions/resolve-ticker/index.ts`:
- Accepts `?ticker=QLTU` 
- Checks if ticker exists in `tase_symbols` table
- If not found, fetches from EODHD: `https://eodhd.com/api/fundamentals/{ticker}.TA?api_token=...&fmt=json` to get company name, ISIN, type
- If valid, inserts into `tase_symbols` and returns the symbol data
- If invalid (404 from EODHD), returns `{ found: false }`

### 3. Update SearchBar with Fallback Resolution
- When DB search returns 0 results and user submits, call `resolve-ticker` function before navigating
- If the ticker is resolved, navigate to the stock page; the new symbol is now in DB for future searches
- Show a brief "searching..." state during resolution

### 4. Update StockPage for Unknown Stocks
- Currently `StockPage` tries to find the stock in the local `TASE_STOCKS` array for display name — if not found, it falls back to `meta?.name` from the API response
- This already works. No changes needed — `fetch-financials` already accepts any ticker and fetches from EODHD regardless of TA-35 membership
- Remove the `TA35_TICKERS` gate on deep-dive financials so ALL stocks get hierarchical tables (not just TA-35)

### 5. Re-trigger Full Sync
- After deploying the updated `sync-tase-symbols`, trigger it to populate all ~1500+ TASE securities in the database

## Technical Details

**Files to create:**
- `supabase/functions/resolve-ticker/index.ts` — on-demand ticker resolution

**Files to modify:**
- `supabase/functions/sync-tase-symbols/index.ts` — add force-refresh param, improve Hebrew name extraction
- `src/components/SearchBar.tsx` — add fallback call to `resolve-ticker` when no DB results on submit
- `src/pages/StockPage.tsx` — remove `TA35_TICKERS.has(upperTicker)` gate on deep-dive financials (line 294), also call `resolve-ticker` if ticker not in DB to ensure it gets indexed
- `src/data/tase-stocks.ts` — keep as-is for local fallback, but it will no longer be the primary source

**No database schema changes needed** — `tase_symbols` table already has all required columns.

