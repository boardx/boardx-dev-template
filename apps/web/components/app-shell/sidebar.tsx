"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home,
  LayoutGrid,
  User,
  Users,
  LogOut,
  Moon,
  Sun,
  Settings,
  BookOpen,
  UserPlus,
  Gem,
  X,
} from "lucide-react";
import { FeedbackLauncher } from "@/components/feedback/feedback-launcher";
import { cn } from "@/lib/utils";

interface SidebarUser {
  email: string;
  displayName: string;
  avatar: string | null;
}

interface CreditRecord {
  id: string;
  type: "Usage" | "Purchase";
  when: string;
  source: string;
  amount: number;
}

interface CreditRecordsPage {
  page: number;
  total: number;
  hasNext: boolean;
  transactions: CreditRecord[];
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
  const [lang, setLang] = useState<"en" | "zh">("en");
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsPage, setRecordsPage] = useState(1);
  const [creditRecords, setCreditRecords] = useState<CreditRecordsPage | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setHydrated(true);
  }, []);

  // 用户菜单个人 Credit 余额入口（uc-credits-001）：打开菜单时按需拉取个人钱包余额。
  useEffect(() => {
    if (!menuOpen || !user) return;
    let alive = true;
    fetch("/api/credits/wallet?scope=personal")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { wallet?: { balance: number } } | null) => {
        if (alive && data?.wallet) setCreditsBalance(data.wallet.balance);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [menuOpen, user]);

  useEffect(() => {
    if (!recordsOpen || !user) return;
    let alive = true;
    setRecordsLoading(true);
    setRecordsError("");
    fetch(`/api/credits/transactions?scope=personal&page=${recordsPage}&pageSize=8`)
      .then(async (res) => {
        if (!res.ok) throw new Error("request failed");
        return (await res.json()) as { records: CreditRecordsPage };
      })
      .then((data) => {
        if (alive) setCreditRecords(data.records);
      })
      .catch(() => {
        if (alive) setRecordsError("Credit records could not be loaded.");
      })
      .finally(() => {
        if (alive) setRecordsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [recordsOpen, recordsPage, user]);

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

  function setTheme(next: boolean) {
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function toggleTheme() {
    setTheme(!dark);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const initial = user?.displayName?.charAt(0)?.toUpperCase() ?? "?";

  const personalRecords = creditRecords?.transactions ?? [];
  const closeRecords = () => {
    setRecordsOpen(false);
    setRecordsPage(1);
  };

  return (
    <>
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

      {user && <FeedbackLauncher />}

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
            data-testid="user-menu-popup"
            className="absolute bottom-0 left-[3.25rem] z-50 w-62 rounded-12 border border-border bg-popover p-2 shadow-[0_16px_40px_rgba(0,0,0,0.18)]"
          >
            {/* identity */}
            <div
              data-testid="user-menu-identity"
              className="flex items-center gap-2.5 px-2 pb-2.5 pt-2"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-13 font-semibold text-background">
                {initial}
              </div>
              <div className="min-w-0">
                <div
                  data-testid="user-menu-name"
                  className="text-13 font-semibold text-foreground"
                >
                  {user?.displayName ?? "访客"}
                </div>
                <div
                  data-testid="user-menu-email"
                  className="truncate text-11 text-placeholder"
                >
                  {user?.email ?? "未登录"}
                </div>
              </div>
            </div>

            {/* Credits 余额行 */}
            <button
              role="menuitem"
              data-testid="user-menu-credits"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setRecordsOpen(true);
              }}
              className="mb-1.5 flex items-center gap-2 rounded-9 bg-surface-2 px-2.5 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Gem className="h-3.5 w-3.5 text-foreground" />
              <span
                data-testid="user-menu-credits-balance"
                className="flex-1 text-12 font-semibold text-foreground"
              >
                {creditsBalance == null ? "…" : `${creditsBalance.toLocaleString("en-US")} credits`}
              </span>
              <span className="text-11 font-semibold text-foreground">Records</span>
            </button>

            <MenuLink href="/account" testId="user-menu-profile" onClick={() => setMenuOpen(false)}>
              <User className="h-3.5 w-3.5" /> Profile
            </MenuLink>
            <MenuLink href="/teams" testId="user-menu-team" onClick={() => setMenuOpen(false)}>
              <Users className="h-3.5 w-3.5" /> Manage team
            </MenuLink>
            <MenuLink
              href="/account?section=settings"
              testId="user-menu-settings"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="h-3.5 w-3.5" /> Settings
            </MenuLink>
            <MenuLink
              href="/knowledge-base"
              testId="user-menu-kb"
              onClick={() => setMenuOpen(false)}
            >
              <BookOpen className="h-3.5 w-3.5" /> Personal knowledge base
            </MenuLink>
            <MenuLink
              href="/teams"
              testId="user-menu-invite"
              onClick={() => setMenuOpen(false)}
            >
              <UserPlus className="h-3.5 w-3.5" /> Invite friends
            </MenuLink>

            <div className="mx-1.5 my-1.5 h-px bg-muted" />

            {/* Language */}
            <div className="px-2.5 pb-0.5 pt-1 text-10 font-semibold uppercase text-placeholder">
              Language
            </div>
            <div
              role="group"
              aria-label="语言"
              data-testid="user-menu-language"
              className="flex gap-1.5 px-2 pb-1.5"
            >
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={cn(
                  "flex-1 rounded-7 border px-1 py-1 text-12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  lang === "en"
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("zh")}
                aria-pressed={lang === "zh"}
                className={cn(
                  "flex-1 rounded-7 border px-1 py-1 text-12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  lang === "zh"
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                中文
              </button>
            </div>

            {/* Theme */}
            <div className="px-2.5 pb-0.5 pt-0.5 text-10 font-semibold uppercase text-placeholder">
              Theme
            </div>
            <div
              role="group"
              aria-label="主题"
              data-testid="user-menu-theme"
              className="flex gap-1.5 px-2 pb-1.5"
            >
              <button
                type="button"
                onClick={() => setTheme(false)}
                aria-pressed={hydrated && !dark}
                className={cn(
                  "flex-1 rounded-7 border px-1 py-1 text-12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hydrated && !dark
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme(true)}
                aria-pressed={hydrated && dark}
                className={cn(
                  "flex-1 rounded-7 border px-1 py-1 text-12 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hydrated && dark
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                Dark
              </button>
            </div>

            <div className="mx-1.5 my-1.5 h-px bg-muted" />

            <button
              role="menuitem"
              data-testid="user-menu-logout"
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-7 px-2.5 py-2 text-13 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          </div>
        )}
      </div>
    </aside>

      {recordsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="credit-records-title"
          data-testid="credit-records-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-md"
        >
          <div className="w-full max-w-2xl rounded-12 border border-border bg-popover shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex-1">
                <h2 id="credit-records-title" className="text-17 font-semibold text-foreground">
                  Credit Records
                </h2>
                <p data-testid="credit-records-balance" className="mt-1 text-12 text-muted-foreground">
                  {creditsBalance == null ? "Personal credits" : `${creditsBalance.toLocaleString("en-US")} credits`}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close Credit Records"
                data-testid="close-credit-records"
                onClick={closeRecords}
                className="flex h-8 w-8 items-center justify-center rounded-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="flex bg-surface-1 px-3 py-2 text-11 font-semibold text-muted-foreground">
                <div className="w-24">Time</div>
                <div className="w-24">Type</div>
                <div className="flex-1">Source</div>
                <div className="w-24 text-right">Amount</div>
              </div>

              {recordsLoading ? (
                <div data-testid="credit-records-loading" className="flex flex-col gap-2 py-3 animate-pulse">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-9 rounded-7 bg-muted" />
                  ))}
                </div>
              ) : recordsError ? (
                <p role="alert" data-testid="err-credit-records" className="py-4 text-13 text-destructive">
                  {recordsError}
                </p>
              ) : personalRecords.length === 0 ? (
                <div data-testid="credit-records-empty" className="py-10 text-center text-13 text-muted-foreground">
                  No credit records yet.
                </div>
              ) : (
                <div data-testid="credit-records-list">
                  {personalRecords.map((record) => (
                    <div
                      key={record.id}
                      data-testid={`credit-record-${record.id}`}
                      className="flex items-center border-t border-border px-3 py-3 text-13 transition-colors duration-200 hover:bg-surface-1"
                    >
                      <div className="w-24 text-muted-foreground">{record.when}</div>
                      <div className="w-24 text-foreground">{record.type}</div>
                      <div className="flex-1 text-foreground">{record.source}</div>
                      <div className="w-24 text-right font-semibold text-foreground">
                        {record.amount > 0 ? "+" : ""}
                        {record.amount.toLocaleString("en-US")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-12 text-muted-foreground">
                <span data-testid="credit-records-page">
                  Page {creditRecords?.page ?? recordsPage} · {creditRecords?.total ?? personalRecords.length} records
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    data-testid="credit-records-prev"
                    disabled={recordsLoading || recordsPage <= 1}
                    onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                    className="rounded-8 border border-border px-3 py-1.5 text-12 font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    data-testid="credit-records-next"
                    disabled={recordsLoading || !(creditRecords?.hasNext ?? false)}
                    onClick={() => setRecordsPage((p) => p + 1)}
                    className="rounded-8 border border-border px-3 py-1.5 text-12 font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuLink({
  href,
  onClick,
  testId,
  children,
}: {
  href: string;
  onClick: () => void;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      role="menuitem"
      href={href}
      data-testid={testId}
      onClick={onClick}
      className="flex items-center gap-2 rounded-7 px-2.5 py-2 text-13 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </Link>
  );
}
