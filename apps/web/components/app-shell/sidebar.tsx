"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Users,
  DoorOpen,
  User,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarUser {
  email: string;
  displayName: string;
  avatar: string | null;
}

const NAV_ITEMS = [
  { label: "主页", icon: Home, href: "/" },
  { label: "团队", icon: Users, href: "/teams" },
  { label: "房间", icon: DoorOpen, href: "/rooms" },
  { label: "账号", icon: User, href: "/account" },
] as const;

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored !== null) setCollapsed(stored === "true");
    setHydrated(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const initial = user?.displayName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <aside
      aria-label="主导航"
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-background",
        "transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="text-base font-bold text-foreground tracking-tight select-none">
            BoardX
          </span>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            "text-muted-foreground transition-colors duration-200",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {hydrated && collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <div key={href} className="group/nav relative">
              <Link
                href={href}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3",
                  "text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-0",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="truncate">{label}</span>
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </Link>
              {/* CSS tooltip — collapsed only */}
              {collapsed && (
                <span
                  className={cn(
                    "pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2",
                    "whitespace-nowrap rounded-md bg-foreground px-2 py-1",
                    "text-xs text-background shadow-md",
                    "opacity-0 transition-opacity duration-150 group-hover/nav:opacity-100",
                  )}
                >
                  {label}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer — user info + logout */}
      <div className="border-t border-border p-2">
        {user ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-md p-2",
              collapsed && "justify-center",
            )}
          >
            {/* Avatar initial */}
            <div
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold"
            >
              {initial}
            </div>
            {!collapsed && (
              <>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-xs font-medium text-foreground">
                    {user.displayName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={logout}
                  aria-label="退出登录"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    "text-muted-foreground transition-colors duration-200",
                    "hover:bg-destructive/10 hover:text-destructive",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-md px-3",
              "text-sm text-muted-foreground transition-colors duration-200",
              "hover:bg-accent hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <User className="h-5 w-5" />
            {!collapsed && <span>登录</span>}
          </Link>
        )}
      </div>
    </aside>
  );
}
