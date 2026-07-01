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
    title: "用户管理",
    description: "查看、搜索、创建/编辑/删除用户，手动上分",
    href: "/admin/users",
    icon: Users,
    available: true,
  },
  {
    key: "teams",
    title: "团队管理",
    description: "查看、筛选团队，编辑团队类型，手动上分",
    href: "/admin/teams",
    icon: UsersRound,
    available: false,
  },
  {
    key: "ai-store-review",
    title: "AI Store 审核",
    description: "审核提交到平台的 AI Store 项目",
    href: "/admin/ai-store/review",
    icon: Store,
    available: false,
  },
  {
    key: "ai-store-featured",
    title: "AI Store 精选",
    description: "管理官方精选（isFeatured）项目",
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
          setError("加载统计摘要失败，请稍后重试");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { stats: AdminStats };
        setStats(data.stats);
        setLoading(false);
      } catch {
        if (!alive) return;
        setError("加载统计摘要失败，请稍后重试");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const statCards = stats
    ? [
        { label: "用户总数", stat: stats.users },
        { label: "团队总数", stat: stats.teams },
        { label: "AI Store 项目数", stat: stats.aiStoreItems },
      ]
    : [];

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-6 w-6 text-foreground" strokeWidth={2} />
        <div>
          <h1 className="text-26 font-bold tracking-tight text-foreground">后台管理</h1>
          <p className="mt-1 text-13 text-muted-foreground">平台统计摘要与管理模块导航</p>
        </div>
      </div>

      {/* 统计摘要 */}
      <section className="mt-6" aria-label="平台统计摘要">
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
                key={c.label}
                data-testid={`stat-${c.label}`}
                className="rounded-12 border border-border p-4"
              >
                <div className="flex items-center gap-1.5">
                  <div className="text-22 font-bold text-foreground">{c.stat.value.toLocaleString()}</div>
                  {c.stat.mock && (
                    <Badge data-testid={`stat-mock-${c.label}`} variant="muted">
                      占位
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
      <section className="mt-8" aria-label="管理模块导航">
        <h2 className="text-15 font-semibold text-foreground">管理模块</h2>
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
                        即将上线
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
