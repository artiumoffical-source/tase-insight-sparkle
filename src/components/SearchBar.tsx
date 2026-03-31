import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import StockLogo from "@/components/StockLogo";

interface SymbolRow {
  ticker: string;
  name: string;
  name_he: string;
  override_name_he: string | null;
  logo_url: string | null;
  security_id: string | null;
}

/** Strip dots, dashes, spaces, parens — mirrors the DB normalize_search_text() */
function normalize(s: string): string {
  return s.replace(/[.\-\s()]+/g, "").toLowerCase();
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [resolving, setResolving] = useState(false);
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const normalized = normalize(query);
      if (!normalized) { setResults([]); return; }

      // Use the pre-computed search_text column with trigram similarity
      const { data, error } = await supabase
        .from("tase_symbols")
        .select("ticker, name, name_he, override_name_he, logo_url, security_id")
        .ilike("search_text", `%${normalized}%`)
        .limit(8);

      if (error) {
        console.error("Search query error:", error);
        const TASE_STOCKS = (await import("@/data/tase-stocks")).default;
        const filtered = TASE_STOCKS.filter(
          (s) =>
            normalize(s.ticker).includes(normalized) ||
            normalize(s.name).includes(normalized) ||
            normalize(s.nameHe).includes(normalized)
        ).slice(0, 8);
        setResults(filtered.map(s => ({ ticker: s.ticker, name: s.name, name_he: s.nameHe, override_name_he: null, logo_url: null, security_id: null })));
      } else {
        setResults(data ?? []);
      }
    }, 150);

    return () => clearTimeout(debounceRef.current);
  }, [query]);
  const handleSelect = (ticker: string) => {
    setQuery("");
    setShowSuggestions(false);
    navigate(`/stock/${ticker}`);
  };

  // Try to resolve an unknown ticker via the resolve-ticker edge function
  const resolveTicker = async (ticker: string): Promise<boolean> => {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/resolve-ticker?ticker=${encodeURIComponent(ticker)}`,
        { headers: { apikey: anonKey, "Content-Type": "application/json" } }
      );
      if (!resp.ok) return false;
      const data = await resp.json();
      return data?.found === true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length > 0) {
      handleSelect(results[0].ticker);
      return;
    }
    
    const trimmed = query.trim().toUpperCase().replace(/\.TA$/i, "");
    if (!trimmed) return;

    // No DB results — try resolving the ticker on-the-fly
    setResolving(true);
    const found = await resolveTicker(trimmed);
    setResolving(false);
    
    // Navigate regardless — StockPage will handle display
    handleSelect(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        {resolving ? (
          <Loader2 className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-primary animate-spin ${isRtl ? "right-4" : "left-4"}`} />
        ) : (
          <Search className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground ${isRtl ? "right-4" : "left-4"}`} />
        )}
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={t("search.placeholder")}
          className={`h-14 text-base bg-secondary border-border rounded-xl focus:ring-2 focus:ring-primary ${isRtl ? "pr-12 pl-4 text-right" : "pl-12 pr-4 text-left"}`}
          dir={isRtl ? "rtl" : "ltr"}
          disabled={resolving}
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
