"use client";
import { useEffect, useState } from "react";
import { Search, Compass, Bookmark, Plus, ShieldCheck, Share2, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StoreType = "agent" | "ai-tool" | "image-tool" | "template";

interface StoreItem {
  id: number;
  name: string;
  description: string;
  type: StoreType;
  tags: string[];
  examples: string[];
  author: string;
  likes: number;
  views: number;
  featured: boolean;
}

interface ListResponse {
  items: StoreItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type NavItem = { key: string; name: string; icon: typeof Compass };
type NavGroup = { group: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    group: "Browsing",
    items: [
      { key: "explore", name: "Explore", icon: Compass },
      { key: "subscribe", name: "Subscribe", icon: Bookmark },
    ],
  },
  {
    group: "Creation",
    items: [
      { key: "create", name: "Create", icon: Plus },
      { key: "authorized", name: "Authorized Agents", icon: ShieldCheck },
      { key: "shared", name: "Shared", icon: Share2 },
    ],
  },
];

const TYPE_TABS: { key: "all" | StoreType; name: string }[] = [
  { key: "all", name: "All" },
  { key: "agent", name: "Agent" },
  { key: "ai-tool", name: "AI Tool" },
  { key: "image-tool", name: "Image Tool" },
  { key: "template", name: "Template" },
];

const TAGS = ["research", "writing", "design", "productivity", "meetings", "featured"];

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: number | string) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

function StoreSkeleton() {
  return (
    <div
      data-testid="loading"
      className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-36 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

export function StoreBrowser() {
  const [nav, setNav] = useState<string>("explore");
  const [items, setItems] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState<"all" | StoreType>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<StoreItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load(opts: { type: "all" | StoreType; tags: string[]; q: string; page: number }) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (opts.type !== "all") params.set("type", opts.type);
    if (opts.tags[0]) params.set("tag", opts.tags[0]);
    if (opts.q.trim()) params.set("q", opts.q.trim());
    params.set("page", String(opts.page));
    try {
      const res = await fetch(`/api/ai-store/items?${params}`);
      if (!res.ok) {
        setError("加载失败，请稍后重试");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ListResponse;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setError("加载失败，请稍后重试");
    }
    setLoading(false);
  }

  // 仅 Explore 拉全量；其他 submenu（Subscribe/Create/...）当前为占位空态。
  useEffect(() => {
    if (nav === "explore") void load({ type, tags: activeTags, q, page: 1 });
    else {
      setItems([]);
      setLoading(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, type, activeTags]);

  // 详情弹窗：按 id 拉取详情。
  useEffect(() => {
    if (detailId == null) {
      setDetailItem(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/ai-store/items/${detailId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { item: StoreItem }) => {
        if (!cancelled) setDetailItem(data.item);
      })
      .catch(() => {
        if (!cancelled) setDetailItem(null);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function clearFilters() {
    setActiveTags([]);
    setQ("");
    setType("all");
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    void load({ type, tags: activeTags, q, page: p });
  }

  const filtersActive = activeTags.length > 0 || q.trim().length > 0 || type !== "all";
  const isExplore = nav === "explore";
  const navTitle =
    NAV_GROUPS.flatMap((g) => g.items).find((n) => n.key === nav)?.name ?? "Explore";

  return (
    <div className="flex h-full overflow-hidden" data-testid="ai-store">
      {/* store submenu */}
      <aside
        data-testid="store-submenu"
        className="w-62 shrink-0 overflow-auto border-r border-border px-3 py-4.5"
      >
        <div className="px-2 pb-3 text-15 font-bold text-foreground">AI Store</div>
        {NAV_GROUPS.map((g) => (
          <div key={g.group}>
            <div className="px-2 pb-1.5 pt-3 text-10 font-semibold uppercase tracking-wide text-placeholder">
              {g.group}
            </div>
            {g.items.map(({ key, name, icon: Icon }) => (
              <Button
                key={key}
                variant="ghost"
                data-testid={`nav-${key}`}
                aria-pressed={nav === key}
                onClick={() => setNav(key)}
                className={cn(
                  "h-8.5 w-full justify-start gap-2 rounded-9 px-2 text-13 font-medium",
                  nav === key
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-surface-1 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{name}</span>
              </Button>
            ))}
          </div>
        ))}
      </aside>

      {/* store content */}
      <section className="flex-1 overflow-auto px-8 py-7">
        <div className="flex items-center gap-3">
          <h1 className="text-22 font-bold tracking-tight text-foreground">{navTitle}</h1>
          {isExplore && (
            <span data-testid="result-count" className="text-13 text-placeholder">
              {total} results
            </span>
          )}
          <div className="flex-1" />
          <Button size="sm" data-testid="create-item" onClick={() => setNav("create")}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>

        {isExplore ? (
          <>
            {/* 搜索 */}
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
              <Input
                data-testid="store-search"
                aria-label="Search AI Store"
                placeholder="Search by name or description…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load({ type, tags: activeTags, q, page: 1 })}
                className="pl-10"
              />
            </div>

            {/* 资源类型 Tab */}
            <div data-testid="type-tabs" className="mt-3.5 flex flex-wrap gap-2.25">
              {TYPE_TABS.map((t) => (
                <Button
                  key={t.key}
                  size="sm"
                  variant={type === t.key ? "default" : "outline"}
                  data-testid={`type-${t.key}`}
                  aria-pressed={type === t.key}
                  onClick={() => setType(t.key)}
                  className="h-8 rounded-full"
                >
                  {t.name}
                </Button>
              ))}
            </div>

            {/* 标签筛选 */}
            <div className="mt-3.25 flex flex-wrap items-center gap-2">
              <span className="text-11 text-placeholder">Tags:</span>
              {TAGS.map((tag) => {
                const on = activeTags.includes(tag);
                return (
                  <Button
                    key={tag}
                    size="sm"
                    variant={on ? "secondary" : "ghost"}
                    data-testid={`tag-${tag}`}
                    aria-pressed={on}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "h-7 rounded-full border border-border px-3 text-11 font-medium",
                      on
                        ? "border-foreground bg-foreground text-background hover:bg-surface-dark"
                        : "text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {tag}
                  </Button>
                );
              })}
              {filtersActive && (
                <>
                  <span data-testid="filters-active" className="text-11 text-placeholder">
                    filters active
                  </span>
                  <Button
                    size="sm"
                    variant="link"
                    data-testid="clear-filters"
                    onClick={clearFilters}
                    className="h-7 px-1 text-11 font-semibold text-foreground"
                  >
                    Clear all
                  </Button>
                </>
              )}
            </div>

            {/* 内容 */}
            <div className="mt-5">
              {loading ? (
                <StoreSkeleton />
              ) : error ? (
                <div
                  data-testid="error"
                  role="alert"
                  className="flex flex-col items-center gap-3 rounded-12 border border-border py-12 text-center"
                >
                  <p className="text-13 text-destructive">{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid="retry"
                    onClick={() => load({ type, tags: activeTags, q, page })}
                  >
                    重试
                  </Button>
                </div>
              ) : items.length === 0 ? (
                <div
                  data-testid="empty"
                  className="flex flex-col items-center gap-1.5 py-12 text-center"
                >
                  <LayoutGrid className="h-7.5 w-7.5 text-border-strong" strokeWidth={1.5} />
                  <p className="mt-2 text-13 font-semibold text-foreground">No items here yet</p>
                  <p className="text-13 text-placeholder">
                    Try a different type, tag, or search — or create one.
                  </p>
                  {filtersActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="empty-clear"
                      onClick={clearFilters}
                      className="mt-3"
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div
                    data-testid="item-grid"
                    className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {items.map((it) => (
                      <article
                        key={it.id}
                        data-testid={`item-${it.id}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailId(it.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetailId(it.id);
                          }
                        }}
                        className="relative cursor-pointer rounded-12 border border-border p-4 transition-all hover:border-border-strong hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
                      >
                        {it.featured && (
                          <span className="absolute right-3 top-3 rounded-7 bg-primary px-1.75 py-0.5 text-9 font-bold text-primary-foreground">
                            ★ FEATURED
                          </span>
                        )}
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-10 text-15 font-bold text-foreground/40",
                              fillFor(it.id),
                            )}
                          >
                            {it.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-13 font-semibold text-foreground">
                              {it.name}
                            </div>
                            <div className="truncate text-11 text-placeholder">{it.author}</div>
                          </div>
                        </div>
                        <p className="mt-2.75 min-h-9 text-13 leading-relaxed text-muted-foreground">
                          {it.description}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {it.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-7 bg-muted px-2 py-0.5 text-10 text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          <span className="flex-1" />
                          <span className="text-11 text-placeholder">
                            ♡ {it.likes} · 👁 {it.views}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div
                      data-testid="pagination"
                      className="mt-6 flex items-center justify-center gap-2"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="page-prev"
                        disabled={page <= 1}
                        onClick={() => goToPage(page - 1)}
                      >
                        Prev
                      </Button>
                      <span data-testid="page-indicator" className="text-11 text-placeholder">
                        Page {page} / {totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid="page-next"
                        disabled={page >= totalPages}
                        onClick={() => goToPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        ) : (
          <div data-testid="empty" className="flex flex-col items-center gap-1.5 py-12 text-center">
            <LayoutGrid className="h-7.5 w-7.5 text-border-strong" strokeWidth={1.5} />
            <p className="mt-2 text-13 font-semibold text-foreground">No items here yet</p>
            <p className="text-13 text-placeholder">
              This section is under development — explore the catalog to discover AI capabilities.
            </p>
            <Button
              size="sm"
              variant="outline"
              data-testid="goto-explore"
              onClick={() => setNav("explore")}
              className="mt-3"
            >
              Go to Explore
            </Button>
          </div>
        )}
      </section>

      {/* store detail modal */}
      {detailId != null && (
        <div
          data-testid="item-detail-modal"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35"
          onClick={() => setDetailId(null)}
        >
          <div
            className="max-h-[84vh] w-85 max-w-[92vw] overflow-auto rounded-14 bg-background shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "relative flex h-32 items-center justify-center rounded-t-14 text-30",
                fillFor(detailId),
              )}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="close-detail"
                aria-label="Close"
                onClick={() => setDetailId(null)}
                className="absolute right-2.25 top-2.25 h-7 w-7 rounded-full bg-background/70 text-muted-foreground hover:bg-background"
              >
                ✕
              </Button>
              {detailItem ? detailItem.name.charAt(0).toUpperCase() : ""}
            </div>

            {detailLoading || !detailItem ? (
              <div className="p-6 text-13 text-placeholder" data-testid="detail-loading">
                Loading…
              </div>
            ) : (
              <div className="p-5.5">
                <div className="flex items-center gap-2.5">
                  <div data-testid="detail-name" className="text-17 font-bold text-foreground">
                    {detailItem.name}
                  </div>
                  {detailItem.featured && (
                    <span className="rounded-7 bg-foreground px-1.75 py-0.5 text-9 font-bold text-background">
                      ★ FEATURED
                    </span>
                  )}
                </div>
                <div className="mt-1 text-11 text-placeholder">
                  {detailItem.type} · by {detailItem.author}
                </div>
                <p
                  data-testid="detail-description"
                  className="mt-3.5 text-13 leading-relaxed text-muted-foreground"
                >
                  {detailItem.description}
                </p>

                {detailItem.examples.length > 0 && (
                  <div data-testid="detail-examples" className="mt-4">
                    <div className="text-11 font-semibold uppercase tracking-wide text-placeholder">
                      Examples
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-13 text-muted-foreground">
                      {detailItem.examples.map((ex) => (
                        <li key={ex}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div
                  data-testid="detail-stats"
                  className="mt-4 flex gap-6 border-y border-border py-3.5"
                >
                  <div>
                    <div className="text-17 font-bold text-foreground">{detailItem.likes}</div>
                    <div className="text-11 text-placeholder">Likes</div>
                  </div>
                  <div>
                    <div className="text-17 font-bold text-foreground">{detailItem.views}</div>
                    <div className="text-11 text-placeholder">Views</div>
                  </div>
                </div>

                {/* 订阅入口：F01 只读浏览，订阅动作留给 F03（当前禁用占位）。 */}
                <Button
                  size="sm"
                  disabled
                  data-testid="detail-subscribe"
                  className="mt-4.5 w-full"
                  title="订阅功能即将上线（F03）"
                >
                  Subscribe
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
