import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, BarChart3, ShieldCheck, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@workspace/replit-auth-web";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { href: "/", label: "Overview", icon: LayoutDashboard },
    { href: "/sessions", label: "Sessions", icon: Users },
    { href: "/polls", label: "Polls", icon: BarChart3 },
  ];

  const displayName = user?.name || user?.email || "Admin";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight">Perimtr</span>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <div className="flex items-center gap-3 px-1">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {user?.email && displayName !== user.email && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-foreground"
              onClick={logout}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-auto">
        <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
