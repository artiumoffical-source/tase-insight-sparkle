import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import Navbar from "@/components/Navbar";
import AdSlot from "@/components/AdSlot";
import Index from "./pages/Index";
import StockPage from "./pages/StockPage";
import WatchlistPage from "./pages/WatchlistPage";
import AuthPage from "./pages/AuthPage";
import CalendarPage from "./pages/CalendarPage";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

const App = () => {
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <Navbar />
            <div className="w-full">
              <AdSlot placement="leaderboard" className="my-3" />
            </div>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/stock/:ticker" element={<StockPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
