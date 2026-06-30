import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, FileText, FolderOpen, Flame, Home, Plus, Settings, User } from "lucide-react";
import { cn } from "./ui/utils";
import { Button } from "./ui/button";
import { DevSettingsDialog } from "./DevSettingsDialog";
import { LayoutHeaderContext } from "../context/LayoutHeaderContext";
import {
  getPendingRoomScanDelivery,
  ROOM_SCAN_DELIVERY_EVENT,
} from "../lib/roomScanDelivery";

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

function BottomNav({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { pathname } = useLocation();
  const tabClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );
  const newActive =
    pathname === "/incident" || pathname === "/report" || pathname === "/slides";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface-elevated pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.08)] md:hidden">
      <div className="flex min-h-14 items-stretch px-2">
        <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}>
          <Home className="h-5 w-5" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/records" end className={({ isActive }) => tabClass(isActive)}>
          <FolderOpen className="h-5 w-5" />
          <span>Drafts</span>
        </NavLink>
        <NavLink to="/incident" className={() => tabClass(newActive)}>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              newActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
            )}
          >
            <Plus className="h-4 w-4" />
          </span>
          <span>New</span>
        </NavLink>
        <button type="button" onClick={onOpenSettings} className={tabClass(false)}>
          <User className="h-5 w-5" />
          <span>Profile</span>
        </button>
      </div>
    </nav>
  );
}

function RoomScanDeliveryNavigator() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const navigateToReport = () => {
      if (pathname === "/report" || pathname === "/slides" || pathname === "/incident") {
        return;
      }
      navigate("/report", {
        state: { initialSectionId: "8" },
      });
    };

    window.addEventListener(ROOM_SCAN_DELIVERY_EVENT, navigateToReport);
    if (getPendingRoomScanDelivery() && pathname !== "/report" && pathname !== "/incident") {
      navigateToReport();
    }
    return () => window.removeEventListener(ROOM_SCAN_DELIVERY_EVENT, navigateToReport);
  }, [navigate, pathname]);

  return null;
}

export function Layout() {
  const location = useLocation();
  const [devSettingsOpen, setDevSettingsOpen] = useState(false);
  const [headerSlot, setHeaderSlot] = useState<HTMLElement | null>(null);
  const [headerActionsSlot, setHeaderActionsSlot] = useState<HTMLElement | null>(null);
  const [sidebarSlot, setSidebarSlot] = useState<HTMLElement | null>(null);
  const [hasPageSidebar, setHasPageSidebar] = useState(false);
  const [, setHasPageMenu] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const isDashboard = location.pathname === "/";
  const isReportEditor =
    location.pathname === "/report" || location.pathname === "/slides";
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
        sidebarSlot,
        setHasMenu: setHasPageMenu,
        setHasSidebar: setHasPageSidebar,
        setTitle: setPageTitle,
        setDocumentId,
      }}
    >
    <RoomScanDeliveryNavigator />
    <div className="min-h-screen flex bg-surface">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r md:flex",
          hasPageSidebar
            ? "w-72 border-border bg-surface-elevated text-foreground"
            : "w-60 border-sidebar-border bg-sidebar text-sidebar-foreground"
        )}
      >
        {hasPageSidebar ? (
          <div ref={setSidebarSlot} className="flex min-h-0 flex-1 flex-col" />
        ) : (
          <>
            <SidebarBrand />
            <NavLinks />
            <div className="mt-auto border-t border-sidebar-border p-3">
              <button
                type="button"
                onClick={() => setDevSettingsOpen(true)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-white"
              >
                <Settings className="h-4 w-4 shrink-0 opacity-90" />
                Settings
              </button>
              <p className="px-3 pt-3 text-xs text-sidebar-foreground/50">For official use only</p>
            </div>
          </>
        )}
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Floating top bar — sticky, detached card with room for the device notch.
            Hidden on the dashboard, which renders its own branded header. */}
        {!isDashboard && (
        <header className="sticky top-0 z-40 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-4">
          <div className="flex min-h-[4.5rem] items-center gap-3 rounded-2xl border border-border bg-surface-elevated/90 px-3 shadow-lg ring-1 ring-black/5 backdrop-blur supports-[backdrop-filter]:bg-surface-elevated/75 sm:gap-4 sm:px-5">
            {/* Portal slot for a page to inject its own header menu trigger (e.g. report sections). */}
            <div ref={setHeaderSlot} className="flex items-center" />

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
        )}

        <main className="flex-1">
          <div
            className={cn(
              "w-full px-4 py-6 sm:px-6 sm:py-8 md:pb-8 lg:px-8",
              isReportEditor ? "pb-8" : "pb-28"
            )}
          >
            <Outlet />
          </div>
        </main>

        <footer className="hidden border-t border-border bg-surface-elevated py-4 text-center text-xs text-muted-foreground md:block">
          © 2026 FireSight AI — For official use only
        </footer>
      </div>

      {!isReportEditor && <BottomNav onOpenSettings={() => setDevSettingsOpen(true)} />}

      <DevSettingsDialog open={devSettingsOpen} onOpenChange={setDevSettingsOpen} />
    </div>
    </LayoutHeaderContext.Provider>
  );
}
