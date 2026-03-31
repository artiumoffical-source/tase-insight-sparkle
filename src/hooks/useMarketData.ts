import { useEffect, useState, useRef, useCallback } from "react";

export interface QuoteItem {
  ticker: string;
  price: number;
  change: number;
  source?: string;
  error?: boolean;
}

interface UseMarketDataOptions {
  tickers: string[];
  enabled?: boolean;
}

function isMarketOpen(): boolean {
  const il = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const day = il.getDay();
  const mins = il.getHours() * 60 + il.getMinutes();
  return day >= 0 && day <= 4 && mins >= 600 && mins <= 1050;
}

export function useMarketOpen() {
  const [open, setOpen] = useState(isMarketOpen);
  useEffect(() => {
    const check = () => setOpen(isMarketOpen());
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

export type ConnectionStatus = "live" | "reconnecting" | "closed";

export function useMarketData({ tickers, enabled = true }: UseMarketDataOptions) {
  const [quotes, setQuotes] = useState<Record<string, QuoteItem>>({});
  const [flashes, setFlashes] = useState<Record<string, "up" | "down" | "">>({});
  const [status, setStatus] = useState<ConnectionStatus>("closed");
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number | null>(null);
  const prevPrices = useRef<Record<string, number>>({});
  const marketOpen = useMarketOpen();
  const tickersKey = tickers.join(",");

  const fetchData = useCallback(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey || tickers.length === 0) return;

    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${tickersKey}&_ts=${Date.now()}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" }, cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.quotes) return;
        const newQuotes: Record<string, QuoteItem> = {};
        const newFlashes: Record<string, "up" | "down" | ""> = {};

        (data.quotes as QuoteItem[]).forEach((q) => {
          if (q.error || q.price <= 0) return;
          const key = q.ticker?.replace(".TA", "") ?? q.ticker;
          newQuotes[key] = q;
          const oldPrice = prevPrices.current[key];
          if (oldPrice != null && oldPrice !== q.price) {
            newFlashes[key] = q.price > oldPrice ? "up" : "down";
          }
          prevPrices.current[key] = q.price;
        });

        setQuotes((prev) => ({ ...prev, ...newQuotes }));
        setFlashes(newFlashes);
        setLastUpdateTime(Date.now());
        setStatus(marketOpen ? "live" : "closed");

        setTimeout(() => setFlashes({}), 700);
      })
      .catch(() => {
        if (marketOpen) setStatus("reconnecting");
      });
  }, [tickersKey, marketOpen]);

  // Adaptive polling
  useEffect(() => {
    if (!enabled || tickers.length === 0) return;
    const interval = marketOpen ? 2_000 : 15_000;

    fetchData();
    let id: ReturnType<typeof setInterval> | null = setInterval(fetchData, interval);

    const onVis = () => {
      if (document.hidden) {
        if (id) { clearInterval(id); id = null; }
      } else {
        fetchData();
        if (!id) id = setInterval(fetchData, interval);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (id) clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [fetchData, enabled, marketOpen, tickers.length]);

  // Staleness detection
  useEffect(() => {
    if (!marketOpen || !lastUpdateTime) { setSecondsSinceUpdate(null); return; }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - (lastUpdateTime ?? Date.now())) / 1000);
      setSecondsSinceUpdate(elapsed);
      if (elapsed > 10) setStatus("reconnecting");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdateTime, marketOpen]);

  return { quotes, flashes, status, marketOpen, secondsSinceUpdate };
}
