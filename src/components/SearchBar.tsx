import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Common TASE stocks for quick suggestions
const POPULAR_STOCKS = [
  { ticker: "TEVA", name: "Teva Pharmaceutical" },
  { ticker: "LUMI", name: "Bank Leumi" },
  { ticker: "DSCT", name: "Bank Discount" },
  { ticker: "HARL", name: "Harel Insurance" },
  { ticker: "POLI", name: "Bank Hapoalim" },
  { ticker: "ICL", name: "ICL Group" },
  { ticker: "NICE", name: "NICE Systems" },
  { ticker: "BEZQ", name: "Bezeq" },
  { ticker: "ELCO", name: "Elco Holdings" },
  { ticker: "AZRG", name: "Azrieli Group" },
];

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();

  const filtered = query.length > 0
    ? POPULAR_STOCKS.filter(
        (s) =>
          s.ticker.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase())
      )
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
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search by company name or ticker..."
          className="h-14 pl-12 pr-4 text-base bg-secondary border-border rounded-xl focus:ring-2 focus:ring-primary"
        />
      </div>

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute top-full mt-2 w-full rounded-xl border bg-card shadow-xl z-50 overflow-hidden animate-fade-in">
          {filtered.map((stock) => (
            <button
              key={stock.ticker}
              type="button"
              onMouseDown={() => handleSelect(stock.ticker)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary transition-colors"
            >
              <div>
                <span className="font-display font-semibold">{stock.ticker}</span>
                <span className="ml-2 text-sm text-muted-foreground">{stock.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">TASE</span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
