"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bookmark, Plus, Share2, LayoutGrid, Pencil, Heart, Link2, Trash2, X, Copy, SlidersHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ResourceCatalog } from "./_components/resource-catalog";
import { StoreNavigation } from "./_components/store-navigation";
import type {
  SkillKind,
  StoreDestination,
  StoreItem,
  StoreScope,
  StoreStatus,
  StoreType,
} from "./_components/store-types";
type SubmitAction = "draft" | "publish" | "submit_review";

interface SubscriptionStatus {
  subscribed: boolean;
  personal: boolean;
  team: boolean;
  canManageTeam: boolean;
}

interface FavoriteToggleResponse {
  favorited: boolean;
  likes: number;
}

// P11 F05：分享管理。share 挂在 item 上（同一时刻一条有效链接），grantees 是被授权用户列表。
interface ShareGrantee {
  user_id: number;
  consumer_team_id: number;
  consumer_team_name: string;
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

const TYPE_TABS: { key: "all" | StoreType; name: string }[] = [
  { key: "all", name: "All" },
  { key: "agent", name: "Agent" },
  { key: "skill", name: "Skills" },
  { key: "template", name: "Template" },
];

const CREATOR_TYPES: { key: StoreType; name: string; help: string }[] = [
  { key: "agent", name: "Agent", help: "Reusable AI teammate for AVA and board workflows." },
  { key: "skill", name: "Skill", help: "Focused text, workflow, or image capability." },
  { key: "template", name: "Template", help: "Reusable board, room, or work canvas template." },
];

const EMPTY_FORM = {
  id: null as number | null,
  expectedVersion: undefined as number | undefined,
  type: "agent" as StoreType,
  skillKind: "text" as SkillKind,
  name: "",
  description: "",
  config: "",
  cover: "",
  scope: "personal" as StoreScope,
  tags: "",
  examples: "",
  allowCopy: false,
};

const TAGS = ["research", "writing", "design", "productivity", "meetings", "featured"];

function tagLabel(tag: string) {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

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

function isSubscribable(item: Pick<StoreItem, "scope" | "status">) {
  return item.status === "published" || (item.scope === "platform" && item.status === "approved");
}

function configText(item: StoreItem) {
  const instructions = item.config?.instructions;
  if (typeof instructions === "string") return instructions;
  return item.config && Object.keys(item.config).length > 0 ? JSON.stringify(item.config, null, 2) : "";
}

export function StoreBrowser({
  isSysAdmin = false,
  initialTeam = null,
}: {
  isSysAdmin?: boolean;
  initialTeam?: { id: number; name: string; role: string } | null;
}) {
  const router = useRouter();
  const [nav, setNav] = useState<StoreDestination>("explore");
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
  const [detailError, setDetailError] = useState<number | null>(null);
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingAuthorized, setEditingAuthorized] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState<SubmitAction | null>(null);
  const [archiving, setArchiving] = useState<number | null>(null);
  const [copying, setCopying] = useState<number | null>(null);
  const [usingItem, setUsingItem] = useState<number | null>(null);
  const [builderIdea, setBuilderIdea] = useState("");
  const [builderBusy, setBuilderBusy] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<{ id: number; name: string; role: string } | null>(initialTeam);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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

  // uc-ai-store-003：订阅（个人）。已订阅 id 集合供卡片/详情弹窗展示按钮状态。
  const [subscribedIds, setSubscribedIds] = useState<Set<number>>(new Set());
  const [subscribedItems, setSubscribedItems] = useState<StoreItem[]>([]);
  const [subscribedLoading, setSubscribedLoading] = useState(false);
  const [subscribedError, setSubscribedError] = useState("");
  const [subscribing, setSubscribing] = useState<number | null>(null);
  const [subscribeError, setSubscribeError] = useState("");
  const [detailSubscription, setDetailSubscription] = useState<SubscriptionStatus | null>(null);
  const [canManageTeamSubscriptions, setCanManageTeamSubscriptions] = useState(false);

  async function load(opts: { type: "all" | StoreType; tags: string[]; q: string; page: number }) {
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (opts.type !== "all") params.set("type", opts.type);
    if (opts.tags[0]) params.set("tag", opts.tags[0]);
    if (opts.q.trim()) params.set("q", opts.q.trim());
    params.set("page", String(opts.page));
    try {
      const res = await fetch(`/api/ai-store/items?${params}`, { signal: controller.signal });
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) {
        setError("Failed to load. Please try again.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as ListResponse;
      if (requestId !== requestIdRef.current) return;
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPage(data.page ?? 1);
      setTotalPages(data.totalPages ?? 1);
    } catch (cause) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError("Failed to load. Please try again.");
    }
    setLoading(false);
  }

  async function loadOwned() {
    setOwnedLoading(true);
    setOwnedError("");
    try {
      const res = await fetch("/api/ai-store/items?owner=me");
      if (!res.ok) {
        setOwnedError("Failed to load your items. Please try again.");
        setOwnedLoading(false);
        return;
      }
      const data = (await res.json()) as { items: StoreItem[] };
      setOwnedItems(data.items ?? []);
    } catch {
      setOwnedError("Failed to load your items. Please try again.");
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
        setAuthorizedError("Failed to load authorized items. Please try again.");
        setAuthorizedLoading(false);
        return;
      }
      const data = (await res.json()) as { items: StoreItem[] };
      setAuthorizedItems(data.items ?? []);
    } catch {
      setAuthorizedError("Failed to load authorized items. Please try again.");
    }
    setAuthorizedLoading(false);
  }

  // uc-ai-store-003：「已订阅」列表——当前用户的个人订阅 + 当前团队的团队订阅所命中的项目。
  async function loadSubscribed() {
    setSubscribedLoading(true);
    setSubscribedError("");
    try {
      const res = await fetch("/api/ai-store/items?subscribed=me");
      if (!res.ok) {
        setSubscribedError("Failed to load your subscriptions. Please try again.");
        setSubscribedLoading(false);
        return;
      }
      const data = (await res.json()) as { items: StoreItem[]; canManageTeam?: boolean };
      setSubscribedItems(data.items ?? []);
      setSubscribedIds(new Set((data.items ?? []).map((it) => it.id)));
      setCanManageTeamSubscriptions(data.canManageTeam === true);
    } catch {
      setSubscribedError("Failed to load your subscriptions. Please try again.");
    }
    setSubscribedLoading(false);
  }

  // Explore 拉浏览列表；Create 拉属主列表；Authorized 同时拉属主列表（Manage share 入口）
  // 与被授权列表（自己被授权管理、非本人拥有的项目）；Subscribe 拉已订阅列表。
  useEffect(() => {
    if (nav === "explore" || nav === "featured") {
      const tags = nav === "featured" ? [...new Set(["featured", ...activeTags])] : activeTags;
      void load({ type, tags, q, page: 1 });
    }
    else if (nav === "create" || nav === "authorized" || nav === "shared") {
      setItems([]);
      setLoading(false);
      setError("");
      void loadOwned();
      if (nav === "authorized") void loadAuthorized();
    }
    else if (nav === "subscribe") {
      setItems([]);
      setLoading(false);
      setError("");
      void loadSubscribed();
    }
    else {
      setItems([]);
      setLoading(false);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, type, activeTags]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/teams").then((response) => response.ok ? response.json() : { teams: [] }),
      fetch("/api/teams/current").then((response) => response.ok ? response.json() : { teamId: null }),
    ]).then(([teamsData, currentData]) => {
      if (!active) return;
      const team = (teamsData.teams ?? []).find(
        (candidate: { id: number | string }) => String(candidate.id) === String(currentData.teamId),
      );
      setCurrentTeam(team ? { id: Number(team.id), name: team.name, role: team.role ?? "member" } : null);
    }).catch(() => {
      if (active) setCurrentTeam(null);
    });
    return () => { active = false; };
  }, []);

  // 从分享链接跳转回来的着陆态（见 app/(app)/ai-store/share/[id]/page.tsx）：
  // ?nav=authorized 直接切到 Authorized 视图；?shareError=invalid 提示链接失效；
  // ?shared=<id> 提示成功加入。仅在挂载时读一次 URL，不影响后续 client 状态切换。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const navParam = params.get("nav");
    if (navParam === "authorized") setNav("authorized");
    const viewParam = params.get("view");
    if (["explore", "featured", "subscribe", "create", "authorized", "shared"].includes(viewParam ?? "")) {
      setNav(viewParam as StoreDestination);
    }
    const qParam = params.get("q") ?? "";
    const typeParam = params.get("type");
    const parsedType = ["agent", "skill", "template"].includes(typeParam ?? "")
      ? typeParam as StoreType
      : "all";
    if (qParam || parsedType !== "all") {
      setQ(qParam);
      setType(parsedType);
      void load({ type: parsedType, tags: viewParam === "featured" ? ["featured"] : [], q: qParam, page: 1 });
    }
    if (params.get("shareError") === "invalid") {
      setShareRedeemNotice("分享链接无效、已关闭或项目不存在");
    } else if (params.get("shared")) {
      setShareRedeemNotice("已通过分享链接获得该项目的授权访问");
    }
    if (navParam || params.get("shareError") || params.get("shared")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  // Explore 视图里也要知道自己已订阅了哪些（用于卡片/详情按钮态），首次挂载拉一次。
  useEffect(() => {
    void loadSubscribed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 详情弹窗：按 id 拉取详情。
  useEffect(() => {
    if (detailId == null) {
      setDetailItem(null);
      setDetailSubscription(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    Promise.all([
      fetch(`/api/ai-store/items/${detailId}`),
      fetch(`/api/ai-store/items/${detailId}/subscribe`),
    ])
      .then(async ([itemResponse, subscriptionResponse]) => {
        if (!itemResponse.ok) throw itemResponse;
        const itemData = (await itemResponse.json()) as { item: StoreItem };
        const subscriptionData = subscriptionResponse.ok
          ? ((await subscriptionResponse.json()) as SubscriptionStatus)
          : null;
        return { itemData, subscriptionData };
      })
      .then(({ itemData, subscriptionData }) => {
        if (!cancelled) {
          setDetailItem(itemData.item);
          setDetailSubscription(subscriptionData);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setDetailItem(null);
          setDetailError(cause instanceof Response ? cause.status : 500);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId, detailRequestVersion]);

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
        setShareError("Failed to load share status. Please try again.");
        setShareLoading(false);
        return;
      }
      const data = (await res.json()) as ShareInfoResponse;
      setShareState(data.share);
      setShareGrantees(data.grantees ?? []);
    } catch {
      setShareError("Failed to load share status. Please try again.");
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
        setShareError("Failed to generate share link. Please try again.");
        setShareBusy(false);
        return;
      }
      const data = (await res.json()) as { share: ShareState };
      setShareState(data.share);
      if (data.share.share_token) await copyShareLink(data.share.share_token);
      setShareMessage(wasEnabled ? "管理授权链接已复制" : "分享已重新开启，链接已复制");
    } catch {
      setShareError("Failed to generate share link. Please try again.");
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
        setShareError("Failed to close share link. Please try again.");
        setShareBusy(false);
        return;
      }
      const data = (await res.json()) as { share: ShareState };
      setShareState(data.share);
      setShareMessage("分享链接已关闭");
    } catch {
      setShareError("Failed to close share link. Please try again.");
    }
    setShareBusy(false);
  }

  async function removeGrantee(userId: number, consumerTeamId: number) {
    if (shareItemId == null) return;
    setShareBusy(true);
    setShareError("");
    try {
      const res = await fetch(
        `/api/ai-store/items/${shareItemId}/share/grantees/${userId}?consumerTeamId=${consumerTeamId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setShareError("Failed to remove authorization. Please try again.");
        setShareBusy(false);
        return;
      }
      setShareGrantees((prev) =>
        prev.filter((g) => g.user_id !== userId || g.consumer_team_id !== consumerTeamId),
      );
      setShareMessage("已移除授权");
    } catch {
      setShareError("Failed to remove authorization. Please try again.");
    }
    setShareBusy(false);
  }

  function toggleTag(tag: string) {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function syncUrl(next: {
    nav?: StoreDestination;
    type?: "all" | StoreType;
    q?: string;
    tags?: string[];
    page?: number;
  }) {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    const nextNav = next.nav ?? nav;
    const nextType = next.type ?? type;
    const nextQ = next.q ?? q;
    const nextTags = next.tags ?? activeTags;
    const nextPage = next.page ?? page;
    if (nextNav !== "explore") params.set("view", nextNav);
    if (nextType !== "all") params.set("type", nextType);
    if (nextQ.trim()) params.set("q", nextQ.trim());
    for (const tag of nextTags) params.append("tag", tag);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  function selectDestination(destination: StoreDestination) {
    setDetailId(null);
    setNav(destination);
    syncUrl({ nav: destination, page: 1 });
  }

  function clearFilters() {
    setActiveTags([]);
    setQ("");
    setType("all");
    syncUrl({ type: "all", q: "", tags: [], page: 1 });
  }

  function searchExplore(nextQ: string) {
    setQ(nextQ);
    const tags = nav === "featured" ? [...new Set(["featured", ...activeTags])] : activeTags;
    syncUrl({ q: nextQ, page: 1 });
    void load({ type, tags, q: nextQ, page: 1 });
  }

  function goToPage(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    const tags = nav === "featured" ? [...new Set(["featured", ...activeTags])] : activeTags;
    syncUrl({ page: p });
    void load({ type, tags, q, page: p });
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

  function editItem(item: StoreItem, authorized = false) {
    setForm({
      id: item.id,
      expectedVersion: item.version,
      type: item.type,
      skillKind:
        item.config?.skillKind === "image" || item.config?.skillKind === "text"
          ? item.config.skillKind
          : "text",
      name: item.name,
      description: item.description,
      config: configText(item),
      cover: item.cover ?? "",
      scope: item.scope,
      tags: item.tags.join(", "),
      examples: item.examples.join(", "),
      allowCopy: item.allow_copy,
    });
    setFormErrors({});
    setFormMessage("");
    setEditingAuthorized(authorized);
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
        setFormErrors(data.errors ?? { form: data.error ?? "Failed to save. Please try again." });
        return;
      }
      if (data.item) {
        editItem(data.item, editingAuthorized);
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
      setFormErrors({ form: "Failed to save. Please try again." });
    } finally {
      setSubmitting(null);
    }
  }

  async function archiveItem(item: StoreItem) {
    if (archiving != null || !window.confirm(`Archive "${item.name}"? Existing subscriptions will become unavailable.`)) {
      return;
    }
    setArchiving(item.id);
    setOwnedError("");
    try {
      const res = await fetch(`/api/ai-store/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setOwnedError(data?.error ?? "Failed to archive. Please try again.");
        return;
      }
      if (form.id === item.id) setForm(EMPTY_FORM);
      await loadOwned();
    } catch {
      setOwnedError("Failed to archive. Please try again.");
    } finally {
      setArchiving(null);
    }
  }

  async function copyItem(item: StoreItem) {
    if (!item.allow_copy || copying != null) return;
    setCopying(item.id);
    setSubscribeError("");
    try {
      const res = await fetch(`/api/ai-store/items/${item.id}/copy`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      const data = (await res.json()) as { item?: StoreItem; error?: string };
      if (!res.ok || !data.item) {
        setSubscribeError(data.error ?? "Failed to copy. Please try again.");
        return;
      }
      setDetailId(null);
      editItem(data.item);
      setFormMessage("Copied as a private draft in the current Team");
      await loadOwned();
    } catch {
      setSubscribeError("Failed to copy. Please try again.");
    } finally {
      setCopying(null);
    }
  }

  async function subscribeItem(
    item: StoreItem,
    scope: "personal" | "team" = "personal",
    subscribed = scope === "personal" ? detailSubscription?.personal === true : detailSubscription?.team === true,
  ) {
    if (!isSubscribable(item) || subscribing != null) return;
    setSubscribing(item.id);
    setSubscribeError("");
    try {
      const url = `/api/ai-store/items/${item.id}/subscribe${subscribed ? `?scope=${scope}` : ""}`;
      const res = await fetch(url, {
        method: subscribed ? "DELETE" : "POST",
        headers: subscribed ? undefined : { "Content-Type": "application/json" },
        body: subscribed ? undefined : JSON.stringify({ scope }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubscribeError(data?.error ?? "Action failed. Please try again.");
        return;
      }
      await loadSubscribed();
      if (detailId === item.id) {
        const statusResponse = await fetch(`/api/ai-store/items/${item.id}/subscribe`);
        if (statusResponse.ok) setDetailSubscription((await statusResponse.json()) as SubscriptionStatus);
      }
    } catch {
      setSubscribeError("Action failed. Please try again.");
    } finally {
      setSubscribing(null);
    }
  }

  // uc-ai-store-003：使用入口——按项目类型带入对应场景。
  // agent → 打开带该 Agent 上下文的新 AVA 会话；ai-tool → 打开 AVA 并预选该工具；
  // template → 目前 boards 尚无「按模板建板」入口（超出本 feature 范围），先给出明确的下一步提示。
  async function useItem(item: StoreItem) {
    if (usingItem != null) return;
    setUsingItem(item.id);
    setSubscribeError("");
    try {
      const res = await fetch(`/api/ai-store/items/${item.id}/use`, {
        method: "POST",
        headers: item.type === "template" ? { "Idempotency-Key": crypto.randomUUID() } : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubscribeError(data.error ?? "Unable to use this resource.");
        return;
      }
      setDetailId(null);
      if (item.type === "agent") router.push(`/ava?agentItemId=${item.id}`);
      else if (item.type === "skill") router.push(`/ava?toolItemId=${item.id}`);
      else router.push(`/boards/${data.board.public_id}`);
    } catch {
      setSubscribeError("Unable to use this resource.");
    } finally {
      setUsingItem(null);
    }
  }

  async function buildAgentDraft() {
    if (!builderIdea.trim() || builderBusy) return;
    setBuilderBusy(true);
    setFormErrors({});
    try {
      const res = await fetch("/api/ai-store/agent-builder/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latestUserInput: builderIdea, answers: {}, currentQuestionKey: null, availableModels: ["stub:default"] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormErrors(data.errors ?? { form: data.error ?? "Agent Builder failed. Please try again." });
        return;
      }
      setForm((previous) => ({
        ...previous,
        type: "agent",
        name: data.draft.name,
        description: data.draft.description,
        config: data.draft.config.instructions,
      }));
      setFormMessage("Agent draft generated. Review and edit it before saving.");
    } catch {
      setFormErrors({ form: "Agent Builder failed. Please try again." });
    } finally {
      setBuilderBusy(false);
    }
  }

  const filtersActive = activeTags.length > 0 || q.trim().length > 0 || type !== "all";
  const isExplore = nav === "explore" || nav === "featured";
  const isCreate = nav === "create";
  const isAuthorized = nav === "authorized";
  const isShared = nav === "shared";
  const navTitle = {
    explore: "Explore",
    featured: "Featured",
    subscribe: "My subscriptions",
    create: "Created by me",
    authorized: "Authorized editing",
    shared: "Shared with me",
    "team-review": "Team review",
    "boardx-review": "BoardX review",
  }[nav];
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
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Archive ${it.name}`}
                    title="Archive"
                    disabled={archiving === it.id}
                    data-testid={`archive-item-${it.id}`}
                    onClick={() => void archiveItem(it)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
    <div className="flex h-full min-w-0 flex-col overflow-hidden lg:flex-row" data-testid="ai-store">
      <StoreNavigation
        active={nav}
        currentTeamName={currentTeam?.name ?? "Current Team"}
        canReviewTeam={currentTeam?.role === "owner" || currentTeam?.role === "admin" || canManageTeamSubscriptions}
        isSysAdmin={isSysAdmin}
        onSelect={selectDestination}
      />

      {/* store content */}
      <section data-testid="resource-library-workspace" className="min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-22 font-bold text-foreground">{navTitle}</h1>
            <p className="mt-1 text-12 text-muted-foreground">
              {isExplore ? "Discover Team-scoped Agents, Skills, and Templates." : "Manage AI resources in the current Team context."}
            </p>
          </div>
          {isExplore && (
            <span data-testid="result-count" className="pt-1 text-12 text-placeholder">
              {total} results
            </span>
          )}
          <div className="flex-1" />
          <Button size="sm" data-testid="create-item" onClick={() => selectDestination("create")}>
            <Plus className="h-4 w-4" />
            <span data-testid="create-resource">Create resource</span>
          </Button>
        </div>

        {isExplore ? (
          <>
            <div className="mt-5 flex flex-col gap-3 border-y border-border py-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-placeholder" />
                  <Input
                    data-testid="store-search"
                    aria-label="Search resources"
                    placeholder="Search resources by name or description"
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      searchExplore(event.currentTarget.value);
                    }}
                    className="pl-9"
                  />
                </div>
                <div data-testid="type-tabs" className="flex shrink-0 gap-1 rounded-lg border border-border p-1">
                  {TYPE_TABS.map((tab) => (
                    <Button
                      key={tab.key}
                      type="button"
                      size="sm"
                      variant={type === tab.key ? "secondary" : "ghost"}
                      data-testid={`type-${tab.key}`}
                      aria-pressed={type === tab.key}
                      onClick={() => {
                        setType(tab.key);
                        syncUrl({ type: tab.key, page: 1 });
                      }}
                      className="h-7 px-2.5 text-11"
                    >
                      {tab.name}
                    </Button>
                  ))}
                </div>
                <DropdownMenu
                  align="end"
                  testId="resource-filter-menu"
                  trigger={({ open, onClick }) => (
                    <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={onClick} className="shrink-0">
                      <SlidersHorizontal className="h-4 w-4" />
                      Filters
                    </Button>
                  )}
                >
                  {TAGS.map((tag) => (
                    <DropdownMenuItem key={tag} onSelect={() => toggleTag(tag)}>
                      <Check className={cn("h-3.5 w-3.5", activeTags.includes(tag) ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                      {tagLabel(tag)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="shrink-0 text-10 font-semibold uppercase text-placeholder">Tags</span>
                {TAGS.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={activeTags.includes(tag) ? "secondary" : "ghost"}
                    data-testid={`tag-${tag}`}
                    aria-pressed={activeTags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                    className="h-7 shrink-0 px-2 text-10"
                  >
                    {tagLabel(tag)}
                  </Button>
                ))}
              </div>
              {filtersActive && (
                <div className="flex items-center gap-2">
                  <span data-testid="filters-active" className="text-11 text-muted-foreground">Filters active</span>
                  <Button type="button" size="sm" variant="link" data-testid="clear-filters" onClick={clearFilters} className="h-7 px-1 text-11">Clear all</Button>
                </div>
              )}
            </div>
            <ResourceCatalog
              items={items}
              loading={loading}
              error={error}
              total={total}
              page={page}
              totalPages={totalPages}
              filtersActive={filtersActive}
              subscribedIds={subscribedIds}
              subscribing={subscribing}
              onRetry={() => void load({ type, tags: nav === "featured" ? ["featured", ...activeTags] : activeTags, q, page })}
              onClear={clearFilters}
              onOpen={setDetailId}
              onFavorite={(id) => void toggleFavorite(id)}
              onSubscribe={(item) => void subscribeItem(item, "personal", false)}
              onUse={(item) => void useItem(item)}
              onPage={goToPage}
            />
          </>
        ) : false ? (
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
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  searchExplore(e.currentTarget.value);
                }}
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
                    {tagLabel(tag)}
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
                    Retry
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
                            <div
                              data-testid={`item-source-team-${it.id}`}
                              className="truncate text-10 text-placeholder"
                            >
                              Team #{it.origin_team_id} · v{it.version}
                            </div>
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
                              {tagLabel(tag)}
                            </span>
                          ))}
                          <span className="flex-1" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            data-testid={`favorite-${it.id}`}
                            aria-pressed={it.liked ?? false}
                            aria-label={it.liked ? "Unlike" : "Like"}
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
                        <div className="mt-3 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant={subscribedIds.has(it.id) ? "outline" : "default"}
                            disabled={!isSubscribable(it) || subscribing === it.id}
                            data-testid={`item-subscribe-${it.id}`}
                            onClick={() => {
                              if (subscribedIds.has(it.id)) {
                                setDetailId(it.id);
                                return;
                              }
                              void subscribeItem(it, "personal", false);
                            }}
                            className="h-7 flex-1 text-11"
                          >
                            {subscribedIds.has(it.id) ? "Manage" : "Subscribe"}
                          </Button>
                          {subscribedIds.has(it.id) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              data-testid={`item-use-${it.id}`}
                              onClick={() => useItem(it)}
                              className="h-7 flex-1 text-11"
                            >
                              Use
                            </Button>
                          )}
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
                    disabled={editingAuthorized}
                    className="h-auto justify-start rounded-12 p-4 text-left transition-all duration-200"
                  >
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-13 font-bold">{creator.name}</span>
                      <span className="whitespace-normal text-11 font-medium opacity-80">{creator.help}</span>
                    </span>
                  </Button>
                ))}
              </div>

              {form.type === "skill" && (
                <div data-testid="skill-kind-selector" className="mt-4 flex w-fit rounded-8 border border-border p-1">
                  {(["text", "image"] as const).map((kind) => (
                    <Button
                      key={kind}
                      type="button"
                      size="sm"
                      variant={form.skillKind === kind ? "secondary" : "ghost"}
                      data-testid={`skill-kind-${kind}`}
                      aria-pressed={form.skillKind === kind}
                      onClick={() => updateForm("skillKind", kind)}
                      disabled={editingAuthorized}
                      className="h-7"
                    >
                      {kind === "text" ? "Text Skill" : "Image Skill"}
                    </Button>
                  ))}
                </div>
              )}

              {form.type === "agent" && !editingAuthorized && (
                <div className="mt-4 flex flex-col gap-2 rounded-8 border border-border p-3 sm:flex-row">
                  <Input
                    data-testid="agent-builder-idea"
                    value={builderIdea}
                    onChange={(event) => setBuilderIdea(event.target.value)}
                    placeholder="Describe the Agent you need"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    data-testid="agent-builder-generate"
                    disabled={!builderIdea.trim() || builderBusy}
                    onClick={() => void buildAgentDraft()}
                  >
                    {builderBusy ? "Generating..." : "Generate draft"}
                  </Button>
                </div>
              )}

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
                      {editingAuthorized
                        ? "Edit authorized resource"
                        : form.id
                          ? "Edit AI Store item"
                          : "Create AI Store item"}
                    </h2>
                    <p className="mt-1 text-12 text-placeholder">
                      Fill the required fields, then save, publish, or submit for review.
                    </p>
                  </div>
                  <div className="flex-1" />
                  {form.id && !editingAuthorized && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      data-testid="new-item"
                      onClick={() => {
                        setForm(EMPTY_FORM);
                        setEditingAuthorized(false);
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
                      disabled={editingAuthorized}
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

                  <label className="flex min-h-11 items-center gap-3 rounded-8 border border-border px-3 md:col-span-2">
                    <input type="checkbox"
                      data-testid="field-allow-copy"
                      checked={form.allowCopy}
                      onChange={(event) => updateForm("allowCopy", event.target.checked)}
                      disabled={editingAuthorized}
                      className="h-4 w-4 accent-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block text-13 font-semibold text-foreground">Allow independent copies</span>
                      <span className="block text-11 text-placeholder">Copies become private drafts owned by the receiving Team.</span>
                    </span>
                  </label>

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

                <div
                  data-testid="creator-preview"
                  className="mt-5 border-t border-border pt-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-8 text-15 font-bold text-foreground/50",
                        fillFor(form.name || form.type),
                      )}
                    >
                      {(form.cover || form.name.charAt(0) || form.type.charAt(0)).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p data-testid="preview-name" className="truncate text-13 font-semibold text-foreground">
                        {form.name || "Untitled resource"}
                      </p>
                      <p data-testid="preview-type" className="text-11 text-placeholder">
                        {form.type === "skill"
                          ? `${form.skillKind === "image" ? "Image" : "Text"} Skill`
                          : form.type === "agent"
                            ? "Agent"
                            : "Template"}
                      </p>
                    </div>
                  </div>
                  <p data-testid="preview-description" className="mt-3 text-12 leading-relaxed text-muted-foreground">
                    {form.description || "Add a description to preview how this resource will appear."}
                  </p>
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
                    {editingAuthorized ? "Save changes" : "Save draft"}
                  </Button>
                  {!editingAuthorized && (
                    <>
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
                    </>
                  )}
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
                          <p
                            data-testid={`authorized-origin-team-${it.id}`}
                            className="mt-1 text-11 text-placeholder"
                          >
                            {it.origin_team_name ?? `Team ${it.origin_team_id}`}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={`authorized-edit-item-${it.id}`}
                          onClick={() => editItem(it, true)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : isShared ? (
          <div data-testid="shared-view" className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-15 font-bold text-foreground">Shared resources</h2>
                <p className="mt-1 text-12 text-placeholder">
                  Manage edit links and authorized people for resources owned by this Team.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={loadOwned}>
                Refresh
              </Button>
            </div>
            {ownedLoading ? (
              <div data-testid="loading" className="mt-4 h-24 animate-pulse rounded-8 bg-muted" />
            ) : ownedItems.length === 0 ? (
              <div className="mt-4 border border-dashed border-border py-8 text-center text-13 text-placeholder">
                No resources available to share.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {ownedItems.map((item) => (
                  <article
                    key={item.id}
                    data-testid={`shared-item-${item.id}`}
                    className="flex items-center gap-3 border border-border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-13 font-semibold text-foreground">{item.name}</p>
                      <p className="mt-1 text-11 text-placeholder">
                        {item.type} · {statusLabel(item.status)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={item.status === "draft" || item.status === "rejected"}
                      onClick={() => openShareModal(item.id)}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Manage
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : nav === "subscribe" ? (
          <div data-testid="subscribe-view" className="mt-5">
            {subscribeError && (
              <p role="alert" data-testid="subscribe-view-error" className="mb-3 text-13 text-destructive">
                {subscribeError}
              </p>
            )}
            {subscribedLoading ? (
              <div data-testid="loading" className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-12 bg-muted" />
                ))}
              </div>
            ) : subscribedError && subscribedItems.length === 0 ? (
              <div
                data-testid="error"
                role="alert"
                className="flex flex-col items-center gap-3 rounded-12 border border-border py-12 text-center"
              >
                <p className="text-13 text-destructive">{subscribedError}</p>
                <Button size="sm" variant="outline" data-testid="retry" onClick={loadSubscribed}>
                  Retry
                </Button>
              </div>
            ) : subscribedItems.length === 0 ? (
              <div data-testid="empty" className="flex flex-col items-center gap-1.5 py-12 text-center">
                <Bookmark className="h-7.5 w-7.5 text-border-strong" strokeWidth={1.5} />
                <p className="mt-2 text-13 font-semibold text-foreground">No subscriptions yet</p>
                <p className="text-13 text-placeholder">Subscribe to an Agent, tool, or template from Explore.</p>
                <Button size="sm" variant="outline" data-testid="goto-explore" onClick={() => setNav("explore")} className="mt-3">
                  Go to Explore
                </Button>
              </div>
            ) : (
              <div data-testid="subscribed-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subscribedItems.map((it) => (
                  <article
                    key={it.id}
                    data-testid={`subscribed-item-${it.id}`}
                    className="rounded-12 border border-border p-4"
                  >
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
                        <div className="truncate text-13 font-semibold text-foreground">{it.name}</div>
                        <div className="truncate text-11 text-placeholder">
                          {it.unavailable ? "Unavailable" : it.type}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2.75 min-h-9 text-13 leading-relaxed text-muted-foreground">
                      {it.description}
                    </p>
                    <div data-testid={`subscribed-scopes-${it.id}`} className="mt-2 flex flex-wrap gap-1.5">
                      {it.subscriptionScopes?.includes("personal") && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-11 text-secondary-foreground">
                          Personal
                        </span>
                      )}
                      {it.subscriptionScopes?.includes("team") && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-11 text-secondary-foreground">
                          Team
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid={`subscribed-use-${it.id}`}
                        disabled={it.unavailable}
                        onClick={() => useItem(it)}
                        className="h-7 flex-1 text-11"
                      >
                        Use
                      </Button>
                      {it.subscriptionScopes?.includes("personal") && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={subscribing === it.id}
                          data-testid={`subscribed-unsubscribe-${it.id}`}
                          onClick={() => subscribeItem(it, "personal", true)}
                          className="h-7 flex-1 text-11"
                        >
                          Remove mine
                        </Button>
                      )}
                      {it.subscriptionScopes?.includes("team") && canManageTeamSubscriptions && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={subscribing === it.id}
                          data-testid={`subscribed-unsubscribe-team-${it.id}`}
                          onClick={() => subscribeItem(it, "team", true)}
                          className="h-7 flex-1 text-11"
                        >
                          Remove team
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
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
        <aside
          data-testid="item-detail-modal"
          aria-label="Resource details"
          className="fixed inset-y-0 right-0 z-50 w-full border-l border-border bg-background shadow-xl sm:w-[28rem] lg:w-[30rem]"
        >
          <span data-testid="resource-detail-panel" className="sr-only">Resource details</span>
          <div
            className="h-full overflow-auto bg-background"
          >
            <div
              className={cn(
                "relative flex h-24 items-center justify-center border-b border-border text-22",
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
                className="absolute right-3 top-3 h-8 w-8 bg-background text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
              {detailItem ? detailItem.name.charAt(0).toUpperCase() : ""}
            </div>

            {detailLoading ? (
              <div className="p-6 text-13 text-placeholder" data-testid="detail-loading">
                Loading…
              </div>
            ) : detailError != null || !detailItem ? (
              <div className="p-6" data-testid="detail-error" role="alert">
                <div data-testid={`detail-state-${detailError ?? 500}`}>
                  <p className="text-13 font-semibold text-foreground">
                    {detailError === 403
                      ? "You no longer have access to this resource."
                      : detailError === 404
                        ? "This resource could not be found."
                        : detailError === 409
                          ? "This resource changed. Refresh before continuing."
                          : detailError === 410
                            ? "This resource is no longer available."
                            : "Failed to load this resource."}
                  </p>
                  <p className="mt-1 text-12 text-muted-foreground">The catalog and your current filters remain unchanged.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  data-testid="detail-retry"
                  onClick={() => setDetailRequestVersion((value) => value + 1)}
                >
                  Retry
                </Button>
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
                <div className="mt-1 flex items-center gap-3 text-11 text-placeholder">
                  <span data-testid="detail-source-team">Team #{detailItem.origin_team_id}</span>
                  <span data-testid="detail-version">Version {detailItem.version}</span>
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
                    aria-label={detailItem.liked ? "Unlike" : "Like"}
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

                {subscribeError && (
                  <p role="alert" data-testid="detail-subscribe-error" className="mt-3 text-13 text-destructive">
                    {subscribeError}
                  </p>
                )}

                {/* 订阅/使用入口（F03）：未发布项目不可订阅；已订阅显示取消订阅 + 使用入口。 */}
                <div className="mt-4.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!isSubscribable(detailItem) || subscribing === detailItem.id}
                    variant={detailSubscription?.personal ? "outline" : "default"}
                    data-testid="detail-subscribe"
                    onClick={() => subscribeItem(detailItem, "personal", detailSubscription?.personal === true)}
                    className="flex-1"
                    title={
                      !isSubscribable(detailItem) ? "Unpublished items cannot be subscribed to" : undefined
                    }
                  >
                    {detailSubscription?.personal ? "Unsubscribe for me" : "Subscribe for me"}
                  </Button>
                  {detailSubscription?.canManageTeam && (
                    <Button
                      size="sm"
                      disabled={!isSubscribable(detailItem) || subscribing === detailItem.id}
                      variant={detailSubscription.team ? "outline" : "secondary"}
                      data-testid="detail-subscribe-team"
                      onClick={() => subscribeItem(detailItem, "team", detailSubscription.team)}
                      className="flex-1"
                    >
                      {detailSubscription.team ? "Unsubscribe for team" : "Subscribe for team"}
                    </Button>
                  )}
                  {detailSubscription?.subscribed && (
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="detail-use"
                      onClick={() => void useItem(detailItem)}
                      disabled={usingItem === detailItem.id}
                      className="flex-1"
                    >
                      {usingItem === detailItem.id ? "Opening..." : "Use"}
                    </Button>
                  )}
                  {detailItem.allow_copy && (
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="detail-copy"
                      disabled={copying === detailItem.id}
                      onClick={() => void copyItem(detailItem)}
                      className="flex-1"
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      {copying === detailItem.id ? "Copying..." : "Copy to Team"}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
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
                          key={`${g.user_id}:${g.consumer_team_id}`}
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
                            onClick={() => void removeGrantee(g.user_id, g.consumer_team_id)}
                            className="h-6 px-1.5 text-11 text-destructive hover:text-destructive"
                          >
                            Remove · {g.consumer_team_name}
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
