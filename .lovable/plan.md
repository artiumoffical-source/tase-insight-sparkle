

## Plan: Financial Overrides System

### Overview
Create a system to manually correct EODHD financial data errors per ticker/year/field, and fix `sync-tase-symbols` to stop overwriting Hebrew names.

### Step 1: Database Migration — Create `financial_overrides` table

Create table with columns:
- `id` (uuid, PK)
- `ticker` (text, not null)
- `year` (text, not null) — e.g. "2025" or "2025-06"
- `field` (text, not null) — e.g. "revenue", "netIncome", "operatingIncome"
- `value` (numeric, not null) — the corrected number
- `note` (text) — reason for override
- `created_at` (timestamptz, default now())
- Unique constraint on `(ticker, year, field)`

RLS: service role access only (edge functions use service role key).

### Step 2: Fix `sync-tase-symbols/index.ts`

Two changes:
1. Remove `name_he: ""` from the upsert row mapping — prevents overwriting existing Hebrew names
2. Hebrew map loop: only write when `name_he` is currently empty, using `.eq("name_he", "")`

### Step 3: Apply overrides in `fetch-financials/index.ts`

After `parseFundamentals()` returns and before the cache upsert:

1. Query `financial_overrides` for the current ticker
2. If overrides exist, walk through the income statement arrays (`incomeStatement`, `qIncomeStatement`) and `financials`/`balanceSheet`
3. For each override row, find the matching year/quarter entry and replace **only that exact field** with the override value
4. Do **NOT** recalculate any derived fields (grossProfit, margins, etc.) — leave everything else untouched
5. Log which overrides were applied

### Files Changed
- `supabase/migrations/...` — new migration for `financial_overrides` table
- `supabase/functions/sync-tase-symbols/index.ts` — remove `name_he` from upsert, conditional Hebrew map
- `supabase/functions/fetch-financials/index.ts` — apply overrides after `parseFundamentals()`

### Technical Notes
- Override field names map directly to EODHD keys: `totalRevenue`, `netIncome`, `operatingIncome`, etc.
- Only the exact field specified in the override row is patched; no derived recalculations
- Runs server-side so cached data also contains corrected values
- No UI changes in this step

