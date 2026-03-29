import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import TASE_STOCKS from "@/data/tase-stocks";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();

  const filtered =
    query.length > 0
      ? TASE_STOCKS.filter(
          (s) =>
            s.ticker.toLowerCase().includes(query.toLowerCase()) ||
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            s.nameHe.includes(query)
        ).slice(0, 8)
      : [];

  const handleSelect = (ticker: string) => {
    setQuery("");
    setShowSuggestions(false);
    navigate(`/stock/${ticker}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filtered.length > 0) {
      handleSelect(filtered[0].ticker);
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

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border bg-card shadow-xl z-50 overflow-hidden animate-fade-in">
          {filtered.map((stock) => (
            <button
              key={stock.ticker}
              type="button"
              onMouseDown={() => handleSelect(stock.ticker)}
              className="flex w-full items-center justify-between px-4 py-3 text-start hover:bg-secondary transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-display font-semibold text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {stock.ticker}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{isRtl ? stock.nameHe : stock.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {isRtl ? stock.name : stock.nameHe}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">TASE</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
