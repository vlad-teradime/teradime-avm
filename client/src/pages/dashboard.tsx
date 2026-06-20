import { TrendingUp } from "lucide-react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";

export default function Dashboard() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
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
      </div>
    </AppShell>
  );
}
