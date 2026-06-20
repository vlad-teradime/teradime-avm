import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, TrendingUp, Users, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pe-evaluator", label: "PE Evaluator", icon: TrendingUp },
  { href: "/admin/users", label: "Users", icon: Users, adminOnly: true },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background app-content-layer flex">
      <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 border-b">
          <img src="/teradime-triangle.png" alt="Teradime" className="h-7 w-7" />
          <span className="text-sm font-semibold tracking-tight">Asset Vantage Metrics</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-4 py-3 space-y-2">
          <div className="text-xs text-muted-foreground truncate">
            {user?.username} <span className="opacity-70">({user?.role})</span>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
