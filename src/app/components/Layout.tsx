import { useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import { LayoutDashboard, FileText, FileImage, FolderOpen, Flame, Menu, Settings } from "lucide-react";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { DevSettingsDialog } from "./DevSettingsDialog";
import { LayoutHeaderContext } from "../context/LayoutHeaderContext";

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
  const [devSettingsOpen, setDevSettingsOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [headerActionsSlot, setHeaderActionsSlot] = useState<HTMLElement | null>(null);
  const [hasPageMenu, setHasPageMenu] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const meta =
    routeMeta[location.pathname] ??
    (["/incident", "/report", "/slides"].includes(location.pathname)
      ? routeMeta["/incident"]
      : { title: "FireSight AI", description: "Incident documentation platform" });
  const headerTitle = pageTitle ?? meta.title;

  return (
    <LayoutHeaderContext.Provider
      value={{
        slot: headerSlot,
        actionsSlot: headerActionsSlot,
        setHasMenu: setHasPageMenu,
        setTitle: setPageTitle,
        setDocumentId,
      }}
    >
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
        {/* Floating top bar — sticky, detached card with room for the device notch. */}
        <header className="sticky top-0 z-40 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-4">
          <div className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-border bg-surface-elevated/90 px-3 shadow-lg ring-1 ring-black/5 backdrop-blur supports-[backdrop-filter]:bg-surface-elevated/75 sm:gap-4 sm:px-5">
            {/* Portal slot for a page to inject its own header menu trigger (e.g. report sections). */}
            <div ref={setHeaderSlot} className="flex items-center" />

            {!hasPageMenu && (
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
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground">{headerTitle}</p>
              {documentId && (
                <p className="truncate text-xs text-muted-foreground">{documentId}</p>
              )}
            </div>

            {/* Portal slot for page-provided header actions (e.g. report save). */}
            <div ref={setHeaderActionsSlot} className="flex items-center gap-2" />

            <Button
              variant="ghost"
              size="icon"
              aria-label="Developer settings"
              onClick={() => setDevSettingsOpen(true)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1">
          <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border bg-surface-elevated py-4 text-center text-xs text-muted-foreground">
          © 2026 FireSight AI — For official use only
        </footer>
      </div>

      <DevSettingsDialog open={devSettingsOpen} onOpenChange={setDevSettingsOpen} />
    </div>
    </LayoutHeaderContext.Provider>
  );
}
