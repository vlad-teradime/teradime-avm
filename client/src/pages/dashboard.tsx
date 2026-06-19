import { Button } from "@/components/ui/button";
import { LogOut, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background app-content-layer">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/teradime-triangle.png" alt="Teradime" className="h-8 w-8" />
            <h1 className="text-lg font-semibold tracking-tight">Asset Vantage Metrics</h1>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {user?.username} <span className="text-xs">({user?.role})</span>
            </span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">Screeners</h2>
        <Link href="/pe-evaluator" className="block rounded-lg border bg-card p-6 hover:border-primary transition-colors">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <div>
              <p className="font-semibold">PE Evaluator</p>
              <p className="text-sm text-muted-foreground">5-year historical P/E analysis with hypothetical trade tracking</p>
            </div>
          </div>
        </Link>
      </main>
    </div>
  );
}
