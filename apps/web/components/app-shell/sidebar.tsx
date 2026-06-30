"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, LayoutGrid, User, Users, LogOut, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarUser {
  email: string;
  displayName: string;
  avatar: string | null;
}

// 设计 rail：保留现有导航目的地（Home / Rooms 进 rail，Teams / Profile 进账号菜单）。
// 见 docs/design/boardx-prototype-mapping.md §2.2。
const RAIL_ITEMS = [
  { label: "Home", icon: Home, href: "/" },
  { label: "Rooms", icon: LayoutGrid, href: "/rooms" },
] as const;

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const initial = user?.displayName?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <aside
      aria-label="主导航"
      className="hidden w-15 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-surface-1 py-3 md:flex"
    >
      {/* Logo */}
      <Link
        href="/"
        aria-label="BoardX 首页"
        className="mb-2 flex h-8.5 w-8.5 items-center justify-center rounded-9 bg-primary text-base font-extrabold text-primary-foreground transition-colors hover:bg-surface-dark"
      >
        X
      </Link>

      {/* Rail nav */}
      {RAIL_ITEMS.map(({ label, icon: Icon, href }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              "flex h-11.5 w-11.5 flex-col items-center justify-center gap-0.5 rounded-10 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-muted text-foreground"
                : "text-placeholder hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-[1.0625rem] w-[1.0625rem]" strokeWidth={2} />
            <span className="text-9 font-semibold leading-none">{label}</span>
          </Link>
        );
      })}

      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="主题"
        aria-label="切换主题"
        className="flex h-10 w-10 items-center justify-center rounded-9 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {hydrated && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Account */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title="账号"
          aria-label="账号菜单"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-foreground text-11 font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initial}
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute bottom-0 left-[3.25rem] z-50 w-62 rounded-12 border border-border bg-popover p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
          >
            {/* identity */}
            <div className="flex items-center gap-2.5 px-2 pb-2.5 pt-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-13 font-semibold text-background">
                {initial}
              </div>
              <div className="min-w-0">
                <div className="text-13 font-semibold text-foreground">
                  {user?.displayName ?? "访客"}
                </div>
                <div className="truncate text-11 text-placeholder">
                  {user?.email ?? "未登录"}
                </div>
              </div>
            </div>

            <MenuLink href="/account" onClick={() => setMenuOpen(false)}>
              <User className="h-3.5 w-3.5" /> Profile
            </MenuLink>
            <MenuLink href="/teams" onClick={() => setMenuOpen(false)}>
              <Users className="h-3.5 w-3.5" /> Manage team
            </MenuLink>

            <div className="my-1.5 mx-1.5 h-px bg-muted" />

            <button
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-7 px-2.5 py-2 text-13 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      onClick={onClick}
      className="flex items-center gap-2 rounded-7 px-2.5 py-2 text-13 text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </Link>
  );
}
