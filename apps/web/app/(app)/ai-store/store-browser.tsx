"use client";
import { useEffect, useState } from "react";
import { Search, Compass, Bookmark, Plus, ShieldCheck, Share2, LayoutGrid, Pencil, Heart, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type StoreType = "agent" | "ai-tool" | "image-tool" | "template";
type StoreScope = "personal" | "team" | "platform";
type StoreStatus = "draft" | "published" | "pending" | "approved" | "rejected";
type SubmitAction = "draft" | "publish" | "submit_review";

interface StoreItem {
  id: number;
  name: string;
  description: string;
  type: StoreType;
  scope: StoreScope;
  status: StoreStatus;
  cover: string | null;
  tags: string[];
  examples: string[];
  config?: Record<string, unknown>;
  author: string;
  likes: number;
  views: number;
  featured: boolean;
  liked?: boolean;
}

interface FavoriteToggleResponse {
  favorited: boolean;
  likes: number;
}

// P11 F05：分享管理。share 挂在 item 上（同一时刻一条有效链接），grantees 是被授权用户列表。
interface ShareGrantee {
  user_id: number;
  email: string;
  display_name: string;
  granted_at: string;
}

interface ShareState {
  item_id: number;
  share_token: string | null;
  share_enabled: boolean;
  share_updated_at: string | null;
}

interface ShareInfoResponse {
  share: ShareState | null;
  grantees: ShareGrantee[];
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

const CREATOR_TYPES: { key: StoreType; name: string; help: string }[] = [
  { key: "agent", name: "Agent", help: "Reusable AI teammate for AVA and board workflows." },
  { key: "ai-tool", name: "AI Tool", help: "Focused text or workflow utility." },
  { key: "image-tool", name: "Image Tool", help: "Image generation, editing, or enhancement tool." },
  { key: "template", name: "Template", help: "Reusable board, room, or work canvas template." },
];

const EMPTY_FORM = {
  id: null as number | null,
  type: "agent" as StoreType,
  name: "",
  description: "",
  config: "",
  cover: "",
  scope: "personal" as StoreScope,
  tags: "",
  examples: "",
};

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

function statusLabel(status: StoreStatus) {
  if (status === "pending") return "PENDING";
  return status.toUpperCase();
}

function configText(item: StoreItem) {
  const instructions = item.config?.instructions;
  if (typeof instructions === "string") return instructions;
  return item.config && Object.keys(item.config).length > 0 ? JSON.stringify(item.config, null, 2) : "";
}

export function StoreBrowser() {
  const [nav, setNav] = useState<string>("explore");
  const [items, setItems] = useState<StoreItem[]>([]);
  const [ownedItems, setOwnedItems] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [error, setError] = useState("");
  const [ownedError, setOwnedError] = useState("");
  const [type, setType] = useState<"all" | StoreType>("all");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<StoreItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState<SubmitAction | null>(null);

  // P11 F05：分享管理弹窗状态。shareItemId != null 时弹窗打开，对应 owned 项目的 id。
  const [shareItemId, setShareItemId] = useState<number | null>(null);
  const [shareState, setShareState] = useState<ShareState | null>(null);
  const [shareGrantees, setShareGrantees] = useState<ShareGrantee[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareError, setShareError] = useState("");
  // Authorized 视图：自己被授权管理、非本人拥有的项目。
  const [authorizedItems, setAuthorizedItems] = useState<StoreItem[]>([]);
  const [authorizedLoading, setAuthorizedLoading] = useState(false);
  const [authorizedError, setAuthorizedError] = useState("");
  const [shareRedeemNotice, setShareRedeemNotice] = useState("");

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

  async function loadOwned() {
    setOwnedLoading(true);
    setOwnedError("");
    try {
      const res = await fetch("/api/ai-store/items?owner=me");
      if (!res.ok) {
        setOwnedError("加载你的项目失败，请稍后重试");
        setOwnedLoading(false);
        return;
      }
      const data = (await res.json()) as { items: StoreItem[] };
      setOwnedItems(data.items ?? []);
    } catch {
      setOwnedError("加载你的项目失败，请稍后重试");
    }
    setOwnedLoading(false);
  }

  // P11 F05：Authorized 视图——自己被授权管理、非本人拥有的项目（授权视图只显示被授权
  // 范围内项目）。卡片带「已授权」标识，点开详情弹窗即可管理（内容编辑不在本 feature 范围）。
  async function loadAuthorized() {
    setAuthorizedLoading(true);
    setAuthorizedError("");
    try {
      const res = await fetch("/api/ai-store/items?authorized=me");
      if (!res.ok) {
        setAuthorizedError("加载授权项目失败，请稍后重试");
        setAuthorizedLoading(false);
        return;
      }
      const data = (await res.json()) as { items: StoreItem[] };
      setAuthorizedItems(data.items ?? []);
    } catch {
      setAuthorizedError("加载授权项目失败，请稍后重试");
    }
    setAuthorizedLoading(false);
  }

  // Explore 拉浏览列表；Create 拉属主列表；Authorized 同时拉属主列表（Manage share 入口）
  // 与被授权列表（自己被授权管理、非本人拥有的项目）。
  useEffect(() => {
    if (nav === "explore") void load({ type, tags: activeTags, q, page: 1 });
    else if (nav === "create" || nav === "authorized") {
      setItems([]);
      setLoading(false);
      setError("");
      void loadOwned();
      if (nav === "authorized") void loadAuthorized();
    }
    else {
      setItems([]);
      setLoading(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, type, activeTags]);

  // 从分享链接跳转回来的着陆态（见 app/(app)/ai-store/share/[id]/page.tsx）：
  // ?nav=authorized 直接切到 Authorized 视图；?shareError=invalid 提示链接失效；
  // ?shared=<id> 提示成功加入。仅在挂载时读一次 URL，不影响后续 client 状态切换。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const navParam = params.get("nav");
    if (navParam === "authorized") setNav("authorized");
    if (params.get("shareError") === "invalid") {
      setShareRedeemNotice("分享链接无效、已关闭或项目不存在");
    } else if (params.get("shared")) {
      setShareRedeemNotice("已通过分享链接获得该项目的授权访问");
    }
    if (navParam || params.get("shareError") || params.get("shared")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

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

  // uc-ai-store-004：喜欢/收藏切换，乐观更新 + 失败回滚。心形与计数在卡片和详情弹窗间保持同步。
  async function toggleFavorite(id: number) {
    const prevItem = items.find((it) => it.id === id);
    const prevDetail = detailItem && detailItem.id === id ? detailItem : null;
    const prevLiked = prevItem?.liked ?? prevDetail?.liked ?? false;
    const prevLikes = prevItem?.likes ?? prevDetail?.likes ?? 0;
    const optimisticLiked = !prevLiked;
    const optimisticLikes = optimisticLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1);

    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, liked: optimisticLiked, likes: optimisticLikes } : it)),
    );
    setDetailItem((prev) =>
      prev && prev.id === id ? { ...prev, liked: optimisticLiked, likes: optimisticLikes } : prev,
    );

    try {
      const res = await fetch(`/api/ai-store/items/${id}/favorite`, { method: "POST" });
      if (!res.ok) throw new Error("favorite toggle failed");
      const data = (await res.json()) as FavoriteToggleResponse;
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, liked: data.favorited, likes: data.likes } : it)),
      );
      setDetailItem((prev) => (prev && prev.id === id ? { ...prev, liked: data.favorited, likes: data.likes } : prev));
    } catch {
      // 回滚
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, liked: prevLiked, likes: prevLikes } : it)));
      setDetailItem((prev) => (prev && prev.id === id ? { ...prev, liked: prevLiked, likes: prevLikes } : prev));
    }
  }

  // P11 F05：分享管理弹窗。shareUrlFor 只在前端拼接展示用，实际访问权限由服务端 token 校验。
  function shareUrlFor(itemId: number, token: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/ai-store/share/${itemId}?shareToken=${encodeURIComponent(token)}`;
  }

  async function loadShareInfo(itemId: number) {
    setShareLoading(true);
    setShareError("");
    try {
      const res = await fetch(`/api/ai-store/items/${itemId}/share`);
      if (!res.ok) {
        setShareError("加载分享状态失败，请稍后重试");
        setShareLoading(false);
        return;
      }
      const data = (await res.json()) as ShareInfoResponse;
      setShareState(data.share);
      setShareGrantees(data.grantees ?? []);
    } catch {
      setShareError("加载分享状态失败，请稍后重试");
    }
    setShareLoading(false);
  }

  function openShareModal(itemId: number) {
    setShareItemId(itemId);
    setShareMessage("");
    setShareError("");
    void loadShareInfo(itemId);
  }

  function closeShareModal() {
    setShareItemId(null);
    setShareState(null);
    setShareGrantees([]);
    setShareMessage("");
    setShareError("");
  }

  async function copyShareLink(token: string) {
    const url = shareUrlFor(shareItemId!, token);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
    } catch {
      // clipboard 写入失败不阻断流程，链接仍在弹窗内可见可手动复制。
    }
    return url;
  }

  // 生成/重新开启分享链接：已开启时服务端复用同一 token 并重新复制（A1）；
  // 已关闭时服务端生成新 token 并开启（A2），前端据此展示不同的成功提示文案。
  async function enableShare() {
    if (shareItemId == null) return;
    setShareBusy(true);
    setShareError("");
    try {
      const wasEnabled = shareState?.share_enabled ?? false;
      const res = await fetch(`/api/ai-store/items/${shareItemId}/share`, { method: "POST" });
      if (!res.ok) {
        setShareError("生成分享链接失败，请重试");
        setShareBusy(false);
        return;
      }
      const data = (await res.json()) as { share: ShareState };
      setShareState(data.share);
      if (data.share.share_token) await copyShareLink(data.share.share_token);
      setShareMessage(wasEnabled ? "管理授权链接已复制" : "分享已重新开启，链接已复制");
    } catch {
      setShareError("生成分享链接失败，请重试");
    }
    setShareBusy(false);
  }

  async function disableShare() {
    if (shareItemId == null) return;
    setShareBusy(true);
    setShareError("");
    try {
      const res = await fetch(`/api/ai-store/items/${shareItemId}/share`, { method: "DELETE" });
      if (!res.ok) {
        setShareError("关闭分享失败，请重试");
        setShareBusy(false);
        return;
      }
      const data = (await res.json()) as { share: ShareState };
      setShareState(data.share);
      setShareMessage("分享链接已关闭");
    } catch {
      setShareError("关闭分享失败，请重试");
    }
    setShareBusy(false);
  }

  async function removeGrantee(userId: number) {
    if (shareItemId == null) return;
    setShareBusy(true);
    setShareError("");
    try {
      const res = await fetch(`/api/ai-store/items/${shareItemId}/share/grantees/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setShareError("移除授权失败，请重试");
        setShareBusy(false);
        return;
      }
      setShareGrantees((prev) => prev.filter((g) => g.user_id !== userId));
      setShareMessage("已移除授权");
    } catch {
      setShareError("移除授权失败，请重试");
    }
    setShareBusy(false);
  }

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

  function updateForm<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormMessage("");
  }

  function editItem(item: StoreItem) {
    setForm({
      id: item.id,
      type: item.type,
      name: item.name,
      description: item.description,
      config: configText(item),
      cover: item.cover ?? "",
      scope: item.scope,
      tags: item.tags.join(", "),
      examples: item.examples.join(", "),
    });
    setFormErrors({});
    setFormMessage("");
    setNav("create");
  }

  async function submitItem(action: SubmitAction) {
    setSubmitting(action);
    setFormErrors({});
    setFormMessage("");
    try {
      const res = await fetch(form.id ? `/api/ai-store/items/${form.id}` : "/api/ai-store/items", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, action }),
      });
      const data = (await res.json()) as { item?: StoreItem; errors?: Record<string, string>; error?: string };
      if (!res.ok) {
        setFormErrors(data.errors ?? { form: data.error ?? "保存失败，请稍后重试" });
        return;
      }
      if (data.item) {
        editItem(data.item);
        setFormMessage(
          action === "submit_review"
            ? "已提交审核，状态为 PENDING"
            : action === "publish"
              ? "已发布"
              : "草稿已保存"
        );
      }
      await loadOwned();
    } catch {
      setFormErrors({ form: "保存失败，请稍后重试" });
    } finally {
      setSubmitting(null);
    }
  }

  const filtersActive = activeTags.length > 0 || q.trim().length > 0 || type !== "all";
  const isExplore = nav === "explore";
  const isCreate = nav === "create";
  const isAuthorized = nav === "authorized";
  const navTitle =
    NAV_GROUPS.flatMap((g) => g.items).find((n) => n.key === nav)?.name ?? "Explore";
  const ownedList = (
    <div data-testid="owner-items" className="mt-5">
      {ownedLoading ? (
        <div data-testid="loading" className="grid animate-pulse grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-12 bg-muted" />
          ))}
        </div>
      ) : ownedError ? (
        <div
          data-testid="err-owned"
          role="alert"
          className="rounded-12 border border-border p-4 text-13 text-destructive"
        >
          {ownedError}
        </div>
      ) : ownedItems.length === 0 ? (
        <div data-testid="empty" className="rounded-12 border border-dashed border-border py-10 text-center">
          <p className="text-13 font-semibold text-foreground">No owned items yet</p>
          <p className="mt-1 text-13 text-placeholder">Create and save your first AI Store item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {ownedItems.map((it) => (
            <article
              key={it.id}
              data-testid={`owner-item-${it.id}`}
              className="rounded-12 border border-border p-4 transition-all duration-200 hover:border-border-strong hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-10 text-15 font-bold text-foreground/40",
                    fillFor(it.id),
                  )}
                >
                  {(it.cover || it.name.charAt(0)).slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-13 font-semibold text-foreground">{it.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span data-testid={`owner-item-status-${it.id}`} className="rounded-7 bg-muted px-2 py-0.5 text-10 font-bold text-muted-foreground">
                      {statusLabel(it.status)}
                    </span>
                    <span className="rounded-7 bg-muted px-2 py-0.5 text-10 text-muted-foreground">
                      {it.scope}
                    </span>
                    <span className="rounded-7 bg-muted px-2 py-0.5 text-10 text-muted-foreground">
                      {it.type}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-12 leading-relaxed text-muted-foreground">
                    {it.description}
                  </p>
                </div>
                {/* uc-ai-store-005：不符合分享管理条件的资源不展示入口——草稿/审核中/被拒绝
                    的项目还没有稳定对外身份，暂不开放授权链接（草稿内容随时变、拒绝态不该
                    继续分享）；仅 published/pending/approved 且非平台精选的资源展示入口。 */}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid={`edit-item-${it.id}`}
                    onClick={() => editItem(it)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {it.status !== "draft" && it.status !== "rejected" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`share-item-${it.id}`}
                      onClick={() => openShareModal(it.id)}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );

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
                          <span
                            data-testid={`item-featured-badge-${it.id}`}
                            className="absolute right-3 top-3 rounded-7 bg-primary px-1.75 py-0.5 text-9 font-bold text-primary-foreground"
                          >
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-testid={`favorite-${it.id}`}
                            aria-pressed={it.liked ?? false}
                            aria-label={it.liked ? "取消喜欢" : "喜欢"}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleFavorite(it.id);
                            }}
                            className={cn(
                              "h-6 gap-1 rounded-full px-1.5 text-11 font-normal",
                              it.liked
                                ? "text-destructive hover:text-destructive"
                                : "text-placeholder hover:text-destructive",
                            )}
                          >
                            <Heart
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              fill={it.liked ? "currentColor" : "none"}
                            />
                            <span data-testid={`likes-${it.id}`}>{it.likes}</span>
                          </Button>
                          <span className="text-11 text-placeholder">👁 {it.views}</span>
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
        ) : isCreate ? (
          <div data-testid="create-view" className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
            <div>
              <div data-testid="creator-types" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {CREATOR_TYPES.map((creator) => (
                  <Button
                    key={creator.key}
                    type="button"
                    variant={form.type === creator.key ? "default" : "outline"}
                    data-testid={`creator-type-${creator.key}`}
                    aria-pressed={form.type === creator.key}
                    onClick={() => updateForm("type", creator.key)}
                    className="h-auto justify-start rounded-12 p-4 text-left transition-all duration-200"
                  >
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-13 font-bold">{creator.name}</span>
                      <span className="whitespace-normal text-11 font-medium opacity-80">{creator.help}</span>
                    </span>
                  </Button>
                ))}
              </div>

              <form
                data-testid="creator-form"
                className="mt-5 rounded-12 border border-border p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitItem("draft");
                }}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <h2 className="text-15 font-bold text-foreground">
                      {form.id ? "Edit AI Store item" : "Create AI Store item"}
                    </h2>
                    <p className="mt-1 text-12 text-placeholder">
                      Fill the required fields, then save, publish, or submit for review.
                    </p>
                  </div>
                  <div className="flex-1" />
                  {form.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      data-testid="new-item"
                      onClick={() => {
                        setForm(EMPTY_FORM);
                        setFormErrors({});
                        setFormMessage("");
                      }}
                    >
                      New
                    </Button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="store-name">Name</Label>
                    <Input
                      id="store-name"
                      data-testid="field-name"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      aria-describedby={formErrors.name ? "store-name-error" : undefined}
                      placeholder="Customer Research Agent"
                    />
                    {formErrors.name && (
                      <p id="store-name-error" role="alert" data-testid="err-name" className="text-xs text-destructive">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="store-scope">Visibility</Label>
                    <Select
                      id="store-scope"
                      data-testid="field-scope"
                      value={form.scope}
                      onChange={(e) => updateForm("scope", e.target.value as StoreScope)}
                    >
                      <option value="personal">Personal</option>
                      <option value="team">Team</option>
                      <option value="platform">Platform review</option>
                    </Select>
                    {formErrors.scope && (
                      <p role="alert" data-testid="err-scope" className="text-xs text-destructive">
                        {formErrors.scope}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="store-description">Description</Label>
                    <Textarea
                      id="store-description"
                      data-testid="field-description"
                      value={form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      aria-describedby={formErrors.description ? "store-description-error" : undefined}
                      placeholder="What this item does and when to use it."
                    />
                    {formErrors.description && (
                      <p id="store-description-error" role="alert" data-testid="err-description" className="text-xs text-destructive">
                        {formErrors.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="store-config">Configuration</Label>
                    <Textarea
                      id="store-config"
                      data-testid="field-config"
                      value={form.config}
                      onChange={(e) => updateForm("config", e.target.value)}
                      aria-describedby={formErrors.config ? "store-config-error" : undefined}
                      placeholder="Instructions, prompts, schema, or reusable setup."
                    />
                    {formErrors.config && (
                      <p id="store-config-error" role="alert" data-testid="err-config" className="text-xs text-destructive">
                        {formErrors.config}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="store-cover">Icon</Label>
                    <Input
                      id="store-cover"
                      data-testid="field-cover"
                      value={form.cover}
                      onChange={(e) => updateForm("cover", e.target.value)}
                      placeholder="R"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="store-tags">Tags</Label>
                    <Input
                      id="store-tags"
                      data-testid="field-tags"
                      value={form.tags}
                      onChange={(e) => updateForm("tags", e.target.value)}
                      placeholder="research, productivity"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <Label htmlFor="store-examples">Examples</Label>
                    <Input
                      id="store-examples"
                      data-testid="field-examples"
                      value={form.examples}
                      onChange={(e) => updateForm("examples", e.target.value)}
                      placeholder="Summarize a customer interview, Draft a research brief"
                    />
                  </div>
                </div>

                {formErrors.form && (
                  <p role="alert" data-testid="err-form" className="mt-4 text-13 text-destructive">
                    {formErrors.form}
                  </p>
                )}
                {formMessage && (
                  <p data-testid="saved" className="mt-4 text-13 font-semibold text-success transition-opacity duration-300">
                    {formMessage}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant="outline"
                    data-testid="action-save-draft"
                    disabled={submitting != null}
                  >
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    data-testid="action-publish"
                    disabled={submitting != null}
                    onClick={() => submitItem("publish")}
                  >
                    Publish
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="action-submit-review"
                    disabled={submitting != null}
                    onClick={() => submitItem("submit_review")}
                  >
                    Submit review
                  </Button>
                </div>
              </form>
            </div>

            <aside className="xl:border-l xl:border-border xl:pl-6">
              <div className="flex items-center justify-between">
                <h2 className="text-15 font-bold text-foreground">Your items</h2>
                <Button type="button" size="sm" variant="ghost" data-testid="refresh-owned" onClick={loadOwned}>
                  Refresh
                </Button>
              </div>
              {ownedList}
            </aside>
          </div>
        ) : isAuthorized ? (
          <div data-testid="authorized-view" className="mt-5">
            {shareRedeemNotice && (
              <div
                data-testid="share-redeem-notice"
                role="status"
                className="mb-4 rounded-10 border border-border bg-surface-1 px-3.5 py-2.5 text-13 text-foreground"
              >
                {shareRedeemNotice}
              </div>
            )}

            <div className="flex items-center gap-3">
              <p className="text-13 text-placeholder">
                Your own items — click Share to generate a management authorization link.
              </p>
              <div className="flex-1" />
              <Button type="button" size="sm" variant="outline" data-testid="authorized-create" onClick={() => setNav("create")}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </div>
            {ownedList}

            <div className="mt-7 flex items-center gap-3 border-t border-border pt-5">
              <h2 className="text-15 font-bold text-foreground">Authorized by others</h2>
            </div>
            <div data-testid="authorized-items" className="mt-3">
              {authorizedLoading ? (
                <div data-testid="loading" className="grid animate-pulse grid-cols-1 gap-3 lg:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-12 bg-muted" />
                  ))}
                </div>
              ) : authorizedError ? (
                <div
                  data-testid="err-authorized"
                  role="alert"
                  className="rounded-12 border border-border p-4 text-13 text-destructive"
                >
                  {authorizedError}
                </div>
              ) : authorizedItems.length === 0 ? (
                <div data-testid="empty-authorized" className="rounded-12 border border-dashed border-border py-8 text-center">
                  <p className="text-13 font-semibold text-foreground">No authorized items</p>
                  <p className="mt-1 text-13 text-placeholder">
                    Items shared with you via a management authorization link will show up here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {authorizedItems.map((it) => (
                    <article
                      key={it.id}
                      data-testid={`authorized-item-${it.id}`}
                      className="rounded-12 border border-border p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-10 text-15 font-bold text-foreground/40",
                            fillFor(it.id),
                          )}
                        >
                          {(it.cover || it.name.charAt(0)).slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-13 font-semibold text-foreground">{it.name}</span>
                            <span
                              data-testid={`authorized-badge-${it.id}`}
                              className="shrink-0 rounded-7 bg-tag-blue px-1.75 py-0.5 text-9 font-bold text-foreground/70"
                            >
                              AUTHORIZED
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-12 leading-relaxed text-muted-foreground">
                            {it.description}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                    <span
                      data-testid="detail-featured-badge"
                      className="rounded-7 bg-foreground px-1.75 py-0.5 text-9 font-bold text-background"
                    >
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
                  className="mt-4 flex items-center gap-6 border-y border-border py-3.5"
                >
                  <div>
                    <div data-testid="detail-likes" className="text-17 font-bold text-foreground">
                      {detailItem.likes}
                    </div>
                    <div className="text-11 text-placeholder">Likes</div>
                  </div>
                  <div>
                    <div className="text-17 font-bold text-foreground">{detailItem.views}</div>
                    <div className="text-11 text-placeholder">Views</div>
                  </div>
                  <div className="flex-1" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    data-testid="detail-favorite"
                    aria-pressed={detailItem.liked ?? false}
                    aria-label={detailItem.liked ? "取消喜欢" : "喜欢"}
                    onClick={() => void toggleFavorite(detailItem.id)}
                    className={cn(
                      "h-9 w-9 shrink-0 rounded-full",
                      detailItem.liked
                        ? "border-destructive text-destructive hover:text-destructive"
                        : "text-placeholder hover:border-destructive hover:text-destructive",
                    )}
                  >
                    <Heart className="h-4.5 w-4.5" strokeWidth={1.75} fill={detailItem.liked ? "currentColor" : "none"} />
                  </Button>
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

      {/* 分享管理弹窗（P11 F05，uc-ai-store-005）：复制授权链接 / 关闭分享链接 / 已授权用户列表。 */}
      {shareItemId != null && (
        <div
          data-testid="share-modal"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35"
          onClick={closeShareModal}
        >
          <div
            className="max-h-[84vh] w-95 max-w-[92vw] overflow-auto rounded-14 bg-background p-5.5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-15 font-bold text-foreground">Share management</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid="close-share-modal"
                aria-label="Close"
                onClick={closeShareModal}
                className="h-7 w-7 rounded-full text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {shareLoading ? (
              <div data-testid="share-loading" className="mt-4 text-13 text-placeholder">
                Loading…
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {shareError && (
                  <div data-testid="share-error" role="alert" className="rounded-10 border border-border p-3 text-13 text-destructive">
                    {shareError}
                  </div>
                )}
                {shareMessage && (
                  <div data-testid="share-message" role="status" className="rounded-10 border border-border bg-surface-1 p-3 text-13 text-foreground">
                    {shareMessage}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-11 font-semibold uppercase tracking-wide text-placeholder">
                      Management authorization link
                    </span>
                    <span
                      data-testid="share-status"
                      className={cn(
                        "rounded-7 px-1.75 py-0.5 text-9 font-bold",
                        shareState?.share_enabled ? "bg-tag-green text-foreground/70" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {shareState?.share_enabled ? "SHARED" : "OFF"}
                    </span>
                  </div>

                  {shareState?.share_enabled && shareState.share_token && (
                    <div
                      data-testid="share-link"
                      className="mt-2 truncate rounded-9 border border-border bg-surface-1 px-2.5 py-2 text-11 text-muted-foreground"
                    >
                      {shareUrlFor(shareItemId, shareState.share_token)}
                    </div>
                  )}

                  <div className="mt-2.5 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      data-testid="share-copy-link"
                      disabled={shareBusy}
                      onClick={() => void enableShare()}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      {shareState?.share_enabled ? "Copy link" : "Generate link"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid="share-revoke-link"
                      disabled={shareBusy || !shareState?.share_enabled}
                      onClick={() => void disableShare()}
                    >
                      Revoke
                    </Button>
                  </div>
                </div>

                <div>
                  <span className="text-11 font-semibold uppercase tracking-wide text-placeholder">
                    Authorized users
                  </span>
                  {shareGrantees.length === 0 ? (
                    <div data-testid="share-grantees-empty" className="mt-2 rounded-9 border border-dashed border-border py-4 text-center text-12 text-placeholder">
                      No authorized users yet
                    </div>
                  ) : (
                    <ul data-testid="share-grantee-list" className="mt-2 space-y-1.5">
                      {shareGrantees.map((g) => (
                        <li
                          key={g.user_id}
                          data-testid={`share-grantee-${g.user_id}`}
                          className="flex items-center justify-between rounded-9 border border-border px-2.5 py-1.75 text-12"
                        >
                          <span className="truncate text-foreground">{g.display_name}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            data-testid={`share-remove-grantee-${g.user_id}`}
                            disabled={shareBusy}
                            onClick={() => void removeGrantee(g.user_id)}
                            className="h-6 px-1.5 text-11 text-destructive hover:text-destructive"
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
