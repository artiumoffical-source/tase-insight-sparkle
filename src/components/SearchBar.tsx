import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import StockLogo from "@/components/StockLogo";

interface SymbolRow {
  ticker: string;
  name: string;
  name_he: string;
  logo_url: string | null;
  security_id: string | null;
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dbReady, setDbReady] = useState(true);
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Search from DB
  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = query.toLowerCase();
      // Use ilike for English searches, or textSearch for Hebrew
      const { data, error } = await supabase
        .from("tase_symbols")
        .select("ticker, name, name_he, logo_url, security_id")
        .or(`ticker.ilike.%${q}%,name.ilike.%${q}%,name_he.ilike.%${q}%,security_id.ilike.%${q}%`)
        .limit(8);

      if (error) {
        console.error("Search query error:", error);
        setDbReady(false);
        // Fallback to local data
        const TASE_STOCKS = (await import("@/data/tase-stocks")).default;
        const filtered = TASE_STOCKS.filter(
          (s) =>
            s.ticker.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q) ||
            s.nameHe.includes(query)
        ).slice(0, 8);
        setResults(filtered.map(s => ({ ticker: s.ticker, name: s.name, name_he: s.nameHe, logo_url: null, security_id: null })));
      } else {
        setResults(data ?? []);
        setDbReady(true);
      }
    }, 150);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (ticker: string) => {
    setQuery("");
    setShowSuggestions(false);
    navigate(`/stock/${ticker}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0].ticker);
    } else if (query.trim()) {
      handleSelect(query.trim().toUpperCase());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Search className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isRtl ? "right-4" : "left-4"}`} />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={t("search.placeholder")}
          className={`h-14 text-base bg-secondary border-border rounded-xl focus:ring-2 focus:ring-primary ${isRtl ? "pr-12 pl-4" : "pl-12 pr-4"}`}
          dir="auto"
        />
      </div>

      {showSuggestions && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border bg-card shadow-xl z-50 overflow-hidden animate-fade-in">
          {results.map((stock) => (
            <button
              key={stock.ticker}
              type="button"
              onMouseDown={() => handleSelect(stock.ticker)}
              className="flex w-full items-center justify-between px-4 py-3 text-start hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <StockLogo name={stock.name} logoUrl={stock.logo_url} size="sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{stock.name_he || stock.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {stock.ticker}
                    </span>
                    <span className="text-xs text-muted-foreground">{stock.name_he ? stock.name : ""}</span>
                    {stock.security_id && (
                      <span className="text-[10px] text-muted-foreground">#{stock.security_id}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
