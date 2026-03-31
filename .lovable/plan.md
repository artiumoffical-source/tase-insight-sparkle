

# Upgrade Live Market Data - Technical Overhaul

## Key Finding
EODHD WebSockets only support **US stocks, Forex, and Crypto** — TASE (.TA) securities are **not available** via WebSocket. Therefore, we cannot implement push-style streaming for Israeli stocks. The plan focuses on maximizing perceived speed through high-frequency polling and polished UI feedback.

## Plan

### 1. Adaptive Polling: 2s During Market Hours, 15s When Closed
**Files:** `src/components/NativeMarketTables.tsx`, `src/components/NativeTickerTape.tsx`

- During market hours (Sun–Thu, 10:00–17:30 Israel time): poll every **2 seconds**
- Outside market hours: poll every **15 seconds** (saves API calls)
- Use the existing `useMarketOpen()` hook to drive the interval dynamically
- On visibility change: immediately fetch + restart at correct interval

### 2. Enhanced Green/Red Flash Animation
**File:** `src/index.css` (or `tailwind.config.ts`)

- Current flash animation exists but is subtle — make it more prominent
- Add a brief background color pulse (green for price up, red for price down) that fades over ~600ms
- Apply to individual price cells in both the Ticker Tape and Market Tables
- Ensure the flash triggers only on actual price changes (already implemented via `prevPrices` ref)

### 3. Live Connection Status Indicator
**File:** `src/components/NativeMarketTables.tsx`

- Replace the current simple "last update" timestamp with a richer status line:
  - Green pulsing dot + "נתונים חיים מהבורסה" during market hours when data is flowing
  - Show seconds since last successful update (e.g., "עודכן לפני 2 שניות")
  - If no update received for >10 seconds, show amber dot + "מתחבר מחדש..."
  - When market closed: gray dot + "נתוני סוף יום"
- Add the same indicator to the Ticker Tape component

### 4. WebSocket-Ready Architecture (Future-Proof)
**File:** Create `src/hooks/useMarketData.ts`

- Extract the polling logic from NativeMarketTables into a shared custom hook
- The hook accepts a `mode` parameter: `"polling"` (current) or `"websocket"` (future)
- Both NativeMarketTables and NativeTickerTape consume this hook instead of duplicating fetch logic
- When a WebSocket API becomes available for TASE, only the hook internals need to change — no UI changes required

### 5. Batch Optimization for 2s Polling
**File:** `supabase/functions/fetch-quotes/index.ts`

- Add a lightweight server-side cache (in-memory Map with 1.5s TTL) so rapid requests within the same second don't hit EODHD/Yahoo twice
- This prevents API rate-limiting when multiple clients poll at 2s intervals
- Log cache hit/miss for monitoring

## Technical Details

**Files to create:**
- `src/hooks/useMarketData.ts` — shared market data hook with adaptive polling

**Files to modify:**
- `src/components/NativeMarketTables.tsx` — use shared hook, add connection status indicator
- `src/components/NativeTickerTape.tsx` — use shared hook, 2s polling during market hours
- `src/index.css` — enhanced flash animations
- `supabase/functions/fetch-quotes/index.ts` — add server-side micro-cache

**No database changes needed.**

