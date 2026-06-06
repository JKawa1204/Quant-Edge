import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  LayoutDashboard, 
  Briefcase, 
  Eye, 
  Activity, 
  ShoppingCart, 
  LineChart, 
  TestTube, 
  SunMoon, 
  LogOut,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portfolio", label: "Portfolio", icon: Briefcase },
    { href: "/watchlist", label: "Watchlist", icon: Eye },
    { href: "/signals", label: "Signals", icon: Activity },
    { href: "/orders", label: "Orders", icon: ShoppingCart },
    { href: "/analytics", label: "Analytics", icon: LineChart },
    { href: "/backtests", label: "Backtests", icon: TestTube },
    { href: "/regime", label: "Regime", icon: SunMoon },
  ];

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight text-primary">QUANTEDGE</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Terminal</p>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Symbol lookup..." className="pl-8 bg-background border-border" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="h-full p-6">
          {children}
        </div>
      </main>
    </div>
  );
}