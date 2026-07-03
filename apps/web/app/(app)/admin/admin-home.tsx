"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, UsersRound, Store, Star, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatItem {
  value: number;
  mock: boolean;
}

interface AdminStats {
  users: StatItem;
  teams: StatItem;
  aiStoreItems: StatItem;
}

interface ModuleCard {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: typeof Users;
  /** F02-F05 尚未建成时，nav 仍可见但目的地是占位页（说明"即将上线"），不假装功能已存在。 */
  available: boolean;
}

const MODULES: ModuleCard[] = [
  {
    key: "users",
    title: "Users",
    description: "View, search, create/edit/delete users, and grant credits manually",
    href: "/admin/users",
    icon: Users,
    available: true,
  },
  {
    key: "teams",
    title: "Teams",
    description: "View and filter teams, edit team type, and grant credits manually",
    href: "/admin/teams",
    icon: UsersRound,
    available: true,
  },
  {
    key: "ai-store-review",
    title: "Store Approval",
    description: "Review AI Store items submitted to the platform",
    href: "/admin/ai-store/review",
    icon: Store,
    available: false,
  },
  {
    key: "ai-store-featured",
    title: "Store Featured",
    description: "Manage officially featured (isFeatured) items",
    href: "/admin/ai-store/featured",
    icon: Star,
    available: false,
  },
];

function StatsSkeleton() {
  return (
    <div data-testid="stats-loading" className="grid animate-pulse grid-cols-2 gap-3.5 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

export function AdminHome() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!alive) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setError("Failed to load stats summary, please try again later");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { stats: AdminStats };
        setStats(data.stats);
        setLoading(false);
      } catch {
        if (!alive) return;
        setError("Failed to load stats summary, please try again later");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // testKey 是稳定的英文 test hook 后缀，与展示用的 label 解耦——label 翻译成英文后
  // 不会影响既有 e2e 对 data-testid 的断言（避免 reskin 顺带改动测试锚点）。
  const statCards = stats
    ? [
        { testKey: "users", label: "Total users", stat: stats.users },
        { testKey: "teams", label: "Teams", stat: stats.teams },
        { testKey: "ai-store-items", label: "AI Store items", stat: stats.aiStoreItems },
      ]
    : [];

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-6 w-6 text-foreground" strokeWidth={2} />
        <div>
          <h1 className="text-26 font-bold tracking-tight text-foreground">Admin Panel</h1>
          <p className="mt-1 text-13 text-muted-foreground">Platform stats summary and module navigation</p>
        </div>
      </div>

      {/* 统计摘要 */}
      <section className="mt-6" aria-label="Platform stats summary">
        {error && (
          <p role="alert" data-testid="stats-error" className="mb-3 text-13 text-destructive">
            {error}
          </p>
        )}
        {loading ? (
          <StatsSkeleton />
        ) : (
          <div data-testid="admin-stats" className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
            {statCards.map((c) => (
              <div
                key={c.testKey}
                data-testid={`stat-${c.testKey}`}
                className="rounded-12 border border-border p-4"
              >
                <div className="flex items-center gap-1.5">
                  <div className="text-22 font-bold text-foreground">{c.stat.value.toLocaleString()}</div>
                  {c.stat.mock && (
                    <Badge data-testid={`stat-mock-${c.testKey}`} variant="muted">
                      Placeholder
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-11 text-muted-foreground">{c.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 模块导航 */}
      <section className="mt-8" aria-label="Admin module navigation">
        <h2 className="text-15 font-semibold text-foreground">Modules</h2>
        <div data-testid="admin-module-nav" className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.key}
                href={m.href}
                data-testid={`module-${m.key}`}
                className="flex items-start gap-3 rounded-12 border border-border p-4 transition-colors hover:bg-surface-1"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-13 font-semibold text-foreground">{m.title}</span>
                    {!m.available && (
                      <Badge data-testid={`module-badge-${m.key}`} variant="outline">
                        Coming soon
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-11 text-muted-foreground">{m.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
