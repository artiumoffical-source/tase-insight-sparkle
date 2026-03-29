import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Lock, Star, TrendingUp, TrendingDown, CalendarDays, Minus } from "lucide-react";
import StockLogo from "@/components/StockLogo";
import AdSlot from "@/components/AdSlot";
import UpgradeModal from "@/components/UpgradeModal";

interface MacroEvent {
  date: string;
  time: string;
  event: string;
  importance: number;
  actual: string | number | null;
  forecast: string | number | null;
  previous: string | number | null;
}

interface EarningsEvent {
  date: string;
  ticker: string;
  name: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revEstimate: number | null;
  revActual: number | null;
}

type DateFilter = "today" | "tomorrow" | "week";

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getDateRange(filter: DateFilter): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "today") {
    const s = fmt(today);
    return { from: s, to: s };
  }
  if (filter === "tomorrow") {
    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    const s = fmt(tom);
    return { from: s, to: s };
  }
  // week
  const end = new Date(today);
  end.setDate(end.getDate() + 6);
  return { from: fmt(today), to: fmt(end) };
}

function ImportanceStars({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= level ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

function ValueCell({ actual, forecast }: { actual: string | number | null; forecast: string | number | null }) {
  if (actual == null || actual === "" || actual === "NA") {
    return <span className="text-muted-foreground">—</span>;
  }

  const a = typeof actual === "string" ? parseFloat(actual) : actual;
  const f = typeof forecast === "string" ? parseFloat(forecast) : forecast;

  let colorClass = "text-foreground";
  if (f != null && !isNaN(a) && !isNaN(f as number)) {
    colorClass = a > (f as number) ? "text-[hsl(var(--gain))]" : a < (f as number) ? "text-[hsl(var(--loss))]" : "text-foreground";
  }

  return <span className={`font-mono font-semibold ${colorClass}`}>{actual}</span>;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const isPremium = user?.email === "artiumoffical@gmail.com";

  const [filter, setFilter] = useState<DateFilter>("today");
  const [macroEvents, setMacroEvents] = useState<MacroEvent[]>([]);
  const [earningsEvents, setEarningsEvents] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const effectiveFilter = !isPremium && filter === "week" ? "today" : filter;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const { from, to } = getDateRange(effectiveFilter);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/fetch-calendar?from=${from}&to=${to}`;
    fetch(url, {
      headers: {
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setMacroEvents(data.macroEvents || []);
        setEarningsEvents(data.earningsEvents || []);
      })
      .catch(() => {
        if (!cancelled) {
          setMacroEvents([]);
          setEarningsEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [effectiveFilter]);

  const handleFilterClick = (f: DateFilter) => {
    if (f === "week" && !isPremium) {
      setUpgradeOpen(true);
      return;
    }
    setFilter(f);
  };

  const filterButtons: { key: DateFilter; label: string }[] = [
    { key: "today", label: t("cal.today") },
    { key: "tomorrow", label: t("cal.tomorrow") },
    { key: "week", label: t("cal.thisWeek") },
  ];

  return (
    <div className="container max-w-5xl py-6 space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarDays className="h-7 w-7 text-primary" />
        <h1 className="font-display text-2xl font-bold">{t("cal.title")}</h1>
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map((fb) => (
          <Button
            key={fb.key}
            size="sm"
            variant={filter === fb.key ? "default" : "outline"}
            onClick={() => handleFilterClick(fb.key)}
            className="relative"
          >
            {fb.label}
            {fb.key === "week" && !isPremium && (
              <Lock className="h-3 w-3 ms-1.5 text-yellow-400" />
            )}
          </Button>
        ))}
      </div>

      {!isPremium && <AdSlot placement="leaderboard" className="my-3" />}

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{t("stock.loading")}</div>
      ) : (
        <>
          {/* Section A: Macro Economic Events */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                {t("cal.macroTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {macroEvents.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  {t("cal.noMacro")}
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-20">{t("cal.time")}</TableHead>
                        <TableHead>{t("cal.event")}</TableHead>
                        <TableHead className="w-24 text-center">{t("cal.importance")}</TableHead>
                        <TableHead className="w-24 text-center">{t("cal.actual")}</TableHead>
                        <TableHead className="w-24 text-center">{t("cal.forecast")}</TableHead>
                        <TableHead className="w-24 text-center">{t("cal.previous")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {macroEvents.map((ev, i) => (
                        <TableRow key={i} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {ev.time || "—"}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{ev.event}</TableCell>
                          <TableCell className="text-center">
                            <ImportanceStars level={ev.importance} />
                          </TableCell>
                          <TableCell className="text-center">
                            <ValueCell actual={ev.actual} forecast={ev.forecast} />
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {ev.forecast ?? "—"}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm text-muted-foreground">
                            {ev.previous ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B: Earnings Calendar */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                {t("cal.earningsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {earningsEvents.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  {t("cal.noEarnings")}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {earningsEvents.map((e, i) => (
                    <Link
                      key={i}
                      to={`/stock/${e.ticker}`}
                      className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3 transition-colors hover:bg-secondary/60"
                    >
                      <StockLogo name={e.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{e.name}</p>
                        <p className="text-xs text-muted-foreground">{e.ticker} · {e.date}</p>
                      </div>
                      {e.epsEstimate != null && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          EPS Est: {e.epsEstimate}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
