"use client";
// uc-admin-004 — AI Store 官方精选页（F05）：切换已通过平台审核（APPROVED）项目的官方精选状态。
// 复用 F04 审核页的资源管理布局（状态 Tab→精选 Tab、搜索、列表、卡片操作按钮、loading/empty 态），
// 卡片操作改为星标切换（isFeatured），走 /api/admin/ai-store/featured* 真实 DB，同一套
// requireSysAdmin() 门控（401→跳登录，403→无权限态，与 F01-F04 同一套判定 + 客户端渲染模式）。
// 精选对象是 p11 的 ai_store_items（scope=platform 且 status=approved，即 F04 的已批准集合），
// 切换即时反映在卡片星标上；未通过审核/已被撤回的项目不出现在此列表，无法被设为精选。
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FeaturedFilter = "" | "true" | "false";

interface FeaturedItem {
  id: number;
  type: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  status: "draft" | "published" | "pending" | "approved" | "rejected";
  featured: boolean;
  updated_at: string;
}

const PAGE_SIZE = 12;

const FEATURED_TABS: { key: FeaturedFilter; label: string }[] = [
  { key: "", label: "全部已批准" },
  { key: "true", label: "已精选" },
  { key: "false", label: "未精选" },
];

function FeaturedSkeleton() {
  return (
    <div data-testid="loading" className="mt-4 animate-pulse space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

export default function AdminAiStoreFeaturedPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "forbidden" | "ok">("checking");

  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("");

  const [togglingId, setTogglingId] = useState<number | null>(null);

  const load = useCallback(
    async (p: number, q: string, featured: FeaturedFilter) => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (featured) params.set("featured", featured);
      try {
        const res = await fetch(`/api/admin/ai-store/featured?${params.toString()}`);
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (res.status === 403) {
          setAuthState("forbidden");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError("加载失败，请稍后重试");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { items: FeaturedItem[]; total: number };
        setAuthState("ok");
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch {
        setError("加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load(1, "", "");
  }, [load]);

  function applyFilters() {
    setPage(1);
    setAppliedQuery(query);
    void load(1, query, featuredFilter);
  }

  function resetFilters() {
    setQuery("");
    setFeaturedFilter("");
    setPage(1);
    setAppliedQuery("");
    void load(1, "", "");
  }

  function selectFeatured(featured: FeaturedFilter) {
    setFeaturedFilter(featured);
    setPage(1);
    void load(1, appliedQuery, featured);
  }

  function goPage(p: number) {
    setPage(p);
    void load(p, appliedQuery, featuredFilter);
  }

  async function toggleFeatured(item: FeaturedItem) {
    if (togglingId != null) return; // 客户端也拦一次并发点击；服务端的原子校验才是真正防线
    setTogglingId(item.id);
    setError("");
    const nextFeatured = !item.featured;
    try {
      const res = await fetch(`/api/admin/ai-store/${item.id}/featured`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featured: nextFeatured }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "操作失败，请稍后重试");
        return;
      }
      const updated = d.item as FeaturedItem;
      // 若当前筛选是"已精选"/"未精选"，切换后可能不再落在筛选范围内，直接从列表移除；
      // 否则原地替换该行，让星标即时反映。
      const stillMatches = !featuredFilter || String(updated.featured) === featuredFilter;
      setItems((current) =>
        stillMatches
          ? current.map((it) => (it.id === updated.id ? updated : it))
          : current.filter((it) => it.id !== updated.id),
      );
      if (!stillMatches) setTotal((t) => Math.max(0, t - 1));
    } catch {
      setError("操作失败，请稍后重试");
    } finally {
      setTogglingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (authState === "forbidden") {
    return (
      <div className="mx-auto max-w-content px-9 pb-14 pt-7">
        <div
          data-testid="admin-forbidden"
          role="alert"
          className="rounded-12 border border-border bg-surface-1 p-8 text-center"
        >
          <h1 className="text-17 font-bold text-foreground">无权限访问</h1>
          <p className="mt-2 text-13 text-muted-foreground">该页面仅限系统管理员访问。</p>
          <Button className="mt-5" variant="secondary" size="sm" onClick={() => router.push("/home")}>
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-content px-9 pb-14 pt-7">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-26 font-bold tracking-tight text-foreground">AI Store 官方精选</h1>
          <p className="mt-1 text-13 text-muted-foreground">
            查看已通过平台审核的 AI Store 项目，切换官方精选状态；精选项目在 Explore 优先展示并带精选标
          </p>
        </div>
      </div>

      {/* 精选 Tab */}
      <div data-testid="featured-tabs" className="mt-5 flex flex-wrap gap-2">
        {FEATURED_TABS.map((tab) => (
          <Button
            key={tab.key || "all"}
            size="sm"
            variant={featuredFilter === tab.key ? "default" : "outline"}
            data-testid={`featured-tab-${tab.key || "all"}`}
            aria-pressed={featuredFilter === tab.key}
            onClick={() => selectFeatured(tab.key)}
            className="h-8 rounded-full"
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* 筛选区 */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-62 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
          <Input
            data-testid="search"
            placeholder="按名称或描述搜索…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-9"
          />
        </div>
        <Button data-testid="search-btn" variant="secondary" onClick={applyFilters}>
          查询
        </Button>
        <Button data-testid="reset-btn" variant="ghost" onClick={resetFilters}>
          重置
        </Button>
      </div>

      {/* 全局错误 */}
      {error && (
        <p role="alert" data-testid="err" className="mt-4 text-13 text-destructive">
          {error}
        </p>
      )}

      {/* 内容：loading / empty / 列表 */}
      {loading ? (
        <FeaturedSkeleton />
      ) : items.length === 0 ? (
        <div
          data-testid="empty"
          className="mt-4 flex flex-col items-center justify-center rounded-12 border border-dashed border-border-strong px-6 py-14 text-center"
        >
          <p className="text-13 font-medium text-foreground">暂无已通过审核的项目</p>
          <p className="mt-1 text-13 text-muted-foreground">调整筛选条件后重试。</p>
        </div>
      ) : (
        <div data-testid="featured-list" className="mt-4 space-y-3">
          {items.map((it) => (
            <article
              key={it.id}
              data-testid={`featured-item-${it.id}`}
              className="rounded-12 border border-border p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-14 font-semibold text-foreground">{it.name}</span>
                    {it.featured && (
                      <Badge data-testid={`featured-badge-${it.id}`} variant="default">
                        FEATURED
                      </Badge>
                    )}
                    <span className="rounded-7 bg-muted px-2 py-0.5 text-10 text-muted-foreground">{it.type}</span>
                  </div>
                  <p className="mt-1.5 text-12 text-muted-foreground">{it.description}</p>
                  <p className="mt-1 text-11 text-placeholder">by {it.author}</p>
                  {it.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.tags.map((tag) => (
                        <span key={tag} className="rounded-7 bg-muted px-2 py-0.5 text-10 text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={it.featured ? "default" : "outline"}
                    data-testid={`toggle-featured-${it.id}`}
                    aria-pressed={it.featured}
                    onClick={() => void toggleFeatured(it)}
                    disabled={togglingId === it.id}
                    className={cn("gap-1.5")}
                  >
                    <Star className={cn("h-3.5 w-3.5", it.featured && "fill-current")} />
                    {togglingId === it.id ? "处理中..." : it.featured ? "取消精选" : "设为精选"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* 分页 */}
      {!loading && items.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-11 text-muted-foreground">
            第 {page} / {totalPages} 页 · 共 {total} 个项目
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="prev-page"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="next-page"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
