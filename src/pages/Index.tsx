import SearchBar from "@/components/SearchBar";
import TrendingStocks from "@/components/TrendingStocks";
import AdSlot from "@/components/AdSlot";
import { BarChart3, TrendingUp, Shield } from "lucide-react";

const FEATURES = [
  { icon: TrendingUp, title: "5-Year Financials", desc: "Revenue, profit, and balance sheet data at a glance" },
  { icon: BarChart3, title: "Interactive Charts", desc: "TradingView-powered charts for every TASE stock" },
  { icon: Shield, title: "Personal Watchlist", desc: "Track your favourite stocks in one place" },
];

export default function Index() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-8 px-4 pt-24 pb-16 text-center">
        <div className="flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-gain animate-pulse" />
          Live TASE Data
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl max-w-3xl leading-tight">
          Israeli Market Intelligence,{" "}
          <span className="text-primary">Simplified</span>
        </h1>
        <p className="max-w-lg text-muted-foreground text-lg">
          Financial data, interactive charts, and watchlists for every stock on the Tel Aviv Stock Exchange.
        </p>
        <SearchBar />
      </section>

      {/* Trending Stocks */}
      <section className="pb-12 w-full flex justify-center">
        <TrendingStocks />
      </section>

      {/* Features */}
      <section className="grid gap-4 px-4 pb-16 sm:grid-cols-3 max-w-4xl w-full">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border bg-card p-6 flex flex-col gap-3 animate-fade-in"
          >
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="font-display font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Ad banner placeholder */}
      <div className="w-full max-w-4xl px-4 pb-12">
        <AdSlot placement="banner" />
      </div>
    </div>
  );
}
