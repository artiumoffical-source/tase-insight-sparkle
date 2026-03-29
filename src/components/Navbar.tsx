import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { BarChart3, Star, LogOut, User } from "lucide-react";

export default function Navbar() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>TASE Insight</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">Home</Link>
          </Button>

          {user && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/watchlist" className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" />
                Watchlist
              </Link>
            </Button>
          )}

          {loading ? null : user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Sign In
              </Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
