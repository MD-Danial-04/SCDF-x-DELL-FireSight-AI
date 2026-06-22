import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import { LayoutDashboard, FileText, FileImage, FolderOpen, Flame, Menu } from "lucide-react";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  isActive?: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  {
    to: "/incident",
    label: "Incident report / slides",
    icon: FileText,
    isActive: (p) => p === "/incident" || p === "/report" || p === "/slides",
  },
  {
    to: "/late-activation",
    label: "Late activation / response slides",
    icon: FileImage,
    isActive: (p) => p === "/late-activation",
  },
  { to: "/records", label: "Records", icon: FolderOpen, end: true },
];

const routeMeta: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Dashboard",
    description: "Start incident documentation or open past records",
  },
  "/incident": {
    title: "Incident report / slides",
    description: "Capture stop message and generate report or slides",
  },
  "/late-activation": {
    title: "Late activation / response slides",
    description: "Generate late activation and response slides for briefings",
  },
  "/records": {
    title: "Records",
    description: "Past fire investigation reports and slide decks",
  },
  "/report": {
    title: "Fire Investigation Report",
    description: "Review fields and generate the Word report",
  },
  "/slides": {
    title: "Activation Slides",
    description: "Build and download activation slide decks",
  },
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map(({ to, label, icon: Icon, end, isActive: matchActive }) => {
        const active = matchActive ? matchActive(pathname) : undefined;

        return (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive: linkActive }) => {
            const isActive = active ?? linkActive;
            return cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-white border-l-[3px] border-l-primary pl-[calc(0.75rem-3px)]"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white"
            );
          }}
        >
          <Icon className="w-4 h-4 shrink-0 opacity-90" />
          {label}
        </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
        <Flame className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <p className="font-bold text-white tracking-tight">FireSight AI</p>
        <p className="text-xs text-sidebar-foreground/70">Incident documentation</p>
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta =
    routeMeta[location.pathname] ??
    (["/incident", "/report", "/slides"].includes(location.pathname)
      ? routeMeta["/incident"]
      : { title: "FireSight AI", description: "Incident documentation platform" });

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <SidebarBrand />
        <NavLinks />
        <div className="mt-auto px-4 py-4 text-xs text-sidebar-foreground/50 border-t border-sidebar-border">
          For official use only
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-surface-elevated/95 backdrop-blur px-4 sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBrand />
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{meta.title}</p>
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {meta.description}
            </p>
          </div>
        </header>

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-surface-elevated py-4 text-center text-xs text-muted-foreground">
          © 2026 FireSight AI — For official use only
        </footer>
      </div>
    </div>
  );
}
