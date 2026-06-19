import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
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
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No screeners enabled yet.
        </div>
      </main>
    </div>
  );
}
