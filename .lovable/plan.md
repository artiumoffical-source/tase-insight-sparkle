

# Data Integrity Audit System

## Database Changes (2 migrations)

### Migration 1: `stock_audit_results` table
```sql
CREATE TABLE public.stock_audit_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL UNIQUE,
  health text NOT NULL DEFAULT 'red',
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_by_admin boolean NOT NULL DEFAULT false,
  last_audited timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_audit_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read audit results" ON public.stock_audit_results
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Superadmins can manage audit results" ON public.stock_audit_results
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
```

### Migration 2: `data_issue_reports` table
```sql
CREATE TABLE public.data_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker text NOT NULL,
  reporter_email text,
  message text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can report issues" ON public.data_issue_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Superadmins can manage reports" ON public.data_issue_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'));
```

## Edge Function: `supabase/functions/audit-financials/index.ts`

Accepts optional `?ticker=LUMI` or audits all tickers in `cached_fundamentals`.

For each ticker, runs these checks against cached data:
1. **Balance Check**: `|Total Assets - (Total Liabilities + Equity)| / Total Assets < 2%`
2. **Income Check**: `|Revenue - Cost of Revenue - Gross Profit| / Revenue < 2%`
3. **Coverage Check**: At least 4 of last 5 years present
4. **Currency Check**: If currency is ILS but values look USD-scale (e.g., revenue > $1B for a small-cap), flag as suspect

Scoring: all pass = green, minor issues = yellow, any critical fail = red. Upserts into `stock_audit_results`.

## Admin Panel: Add Audit Tab to AdminNewsroom

Add a tabbed UI (News | Audit) to `src/pages/AdminNewsroom.tsx`:
- **Audit tab** shows a table: Ticker, Name, Health (green/yellow/red badge), Last Audited, Verified checkbox
- Filter buttons: All / Red / Yellow / Green
- "Run Full Audit" button calls the edge function
- "Data Issue Reports" section with ticker, message, date, and Resolve button
- Verified checkbox toggles `verified_by_admin` via direct update

## Public Stock Page: Report Button

In `src/pages/StockPage.tsx`, add a small "דווח על שגיאה" button near the financials section. Opens a dialog, submits to `data_issue_reports`, shows toast confirmation. Auth-only.

## Technical Details

**Files to create:**
- `supabase/functions/audit-financials/index.ts`

**Files to modify:**
- `src/pages/AdminNewsroom.tsx` — tabbed layout + audit dashboard
- `src/pages/StockPage.tsx` — report issue button + dialog

