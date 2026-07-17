"use client";
// uc-admin-003 — AI Store 平台审核页（F04）：批准/拒绝/撤回 pending/approved 的平台资源。
// 复用 F01 的 requireSysAdmin() 门控（走 /api/admin/ai-store* 真实 DB，401→跳登录，403→无权限态，
// 与 F02/F03 同一套判定 + 同一套客户端渲染模式），审核对象是 p11 的 ai_store_items
// （scope=platform 且 status 在 pending/approved 之列）。
// 安全加固对齐 F02/F03（AGENTS.md 提醒过 #173 手动上分双花问题，审核状态转移同理要防重复提交/越权）：
// 状态转移在服务端用乐观锁 `UPDATE ... WHERE status = 期望值` 完成，重复点击视为幂等，
// 竞态覆盖返回 409 并提示刷新，不允许客户端乐观地"假装成功"。
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldCheck, ShieldX, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ReviewStatus = "pending" | "approved";
type ReviewAction = "approve" | "reject" | "revoke";

interface ReviewItem {
  id: number;
  type: string;
  name: string;
  description: string;
  author: string;
  tags: string[];
  status: "draft" | "published" | "pending" | "approved" | "rejected";
  config?: Record<string, unknown>;
  examples: string[];
  updated_at: string;
}

const PAGE_SIZE = 12;

const STATUS_TABS: { key: ReviewStatus | ""; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
];

function instructionsText(item: ReviewItem) {
  const instructions = item.config?.instructions;
  if (typeof instructions === "string") return instructions;
  return "";
}

function ReviewSkeleton() {
  return (
    <div data-testid="loading" className="mt-4 animate-pulse space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 rounded-12 bg-muted" />
      ))}
    </div>
  );
}

function ConfirmReviewModal({
  item,
  action,
  onClose,
  onConfirmed,
}: {
  item: ReviewItem;
  action: ReviewAction;
  onClose: () => void;
  onConfirmed: (updated: ReviewItem) => void;
}) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const copy: Record<ReviewAction, { title: string; body: string; confirmLabel: string }> = {
    approve: {
      title: "Approve this AI Store item",
      body: "Once approved, this item's status becomes APPROVED and it will be visible on the platform.",
      confirmLabel: "Confirm approve",
    },
    reject: {
      title: "Reject this AI Store item",
      body: "Once rejected, this item's status becomes REJECTED. The creator can edit it and resubmit for review.",
      confirmLabel: "Confirm reject",
    },
    revoke: {
      title: "Revoke approval for this AI Store item",
      body: "Once revoked, this item's status returns to PENDING and re-enters the review queue; it will no longer be visible on the platform.",
      confirmLabel: "Confirm revoke",
    },
  };
  const c = copy[action];

  async function confirm() {
    if (saving) return; // 客户端也拦一次并发点击；服务端的乐观锁转移才是真正防线
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/ai-store/${item.id}/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Action failed, please try again later");
        return;
      }
      onConfirmed(d.item as ReviewItem);
      onClose();
    } catch {
      setError("Action failed, please try again later");
    } finally {
      setSaving(false);
    }
  }

  const instructions = instructionsText(item);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
    >
      <div data-testid="confirm-review-modal" className="w-full max-w-md rounded-10 border border-border bg-popover p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="confirm-review-title" className="text-lg font-semibold text-foreground">
            {c.title}
          </h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose} disabled={saving} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-13 text-muted-foreground">{c.body}</p>

        <div className="mt-3 rounded-9 border border-border bg-surface-1 p-3">
          <div data-testid="confirm-review-name" className="text-13 font-semibold text-foreground">
            {item.name}
          </div>
          <p data-testid="confirm-review-description" className="mt-1 text-12 text-muted-foreground">
            {item.description}
          </p>
          {instructions && (
            <p data-testid="confirm-review-instructions" className="mt-2 whitespace-pre-wrap text-11 text-placeholder">
              {instructions}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" data-testid="err-confirm-review" className="mt-3 text-13 text-destructive">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" data-testid="cancel-review" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="confirm-review"
            variant={action === "reject" ? "destructive" : "default"}
            onClick={() => void confirm()}
            disabled={saving}
          >
            {saving ? "Submitting..." : c.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAiStoreReviewPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"checking" | "forbidden" | "ok">("checking");

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "">("");
  const loadRequestId = useRef(0);

  const [pending, setPending] = useState<{ item: ReviewItem; action: ReviewAction } | null>(null);

  const load = useCallback(
    async (p: number, q: string, status: ReviewStatus | "") => {
      const requestId = ++loadRequestId.current;
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      try {
        const res = await fetch(`/api/admin/ai-store?${params.toString()}`);
        if (requestId !== loadRequestId.current) return;
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
          setError("Failed to load, please try again later");
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { items: ReviewItem[]; total: number };
        if (requestId !== loadRequestId.current) return;
        setAuthState("ok");
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch {
        if (requestId !== loadRequestId.current) return;
        setError("Failed to load, please try again later");
      } finally {
        if (requestId === loadRequestId.current) setLoading(false);
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
    void load(1, query, statusFilter);
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("");
    setPage(1);
    setAppliedQuery("");
    void load(1, "", "");
  }

  function selectStatus(status: ReviewStatus | "") {
    setStatusFilter(status);
    setPage(1);
    void load(1, appliedQuery, status);
  }

  function goPage(p: number) {
    setPage(p);
    void load(p, appliedQuery, statusFilter);
  }

  function onReviewed(updated: ReviewItem) {
    // 批准/拒绝/撤回后，若更新结果不再落在当前筛选范围内（比如筛选"待审核"时批准了一条，
    // 或拒绝后状态离开了 pending/approved 审核队列），直接从当前列表移除；
    // 否则原地替换该行，让状态标即时反映。
    const stillMatches =
      (updated.status === "pending" || updated.status === "approved") &&
      (!statusFilter || updated.status === statusFilter);

    setItems((current) =>
      stillMatches
        ? current.map((it) => (it.id === updated.id ? updated : it))
        : current.filter((it) => it.id !== updated.id),
    );
    setTotal((t) => (stillMatches ? t : Math.max(0, t - 1)));
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
          <h1 className="text-17 font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-13 text-muted-foreground">This page is restricted to system administrators.</p>
          <Button className="mt-5" variant="secondary" size="sm" onClick={() => router.push("/home")}>
            Back to home
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
          <h1 className="text-26 font-bold tracking-tight text-foreground">Store Approval</h1>
          <p className="mt-1 text-13 text-muted-foreground">
            View AI Store items submitted for platform review; approve, reject, or revoke previously approved items
          </p>
        </div>
      </div>

      {/* 状态 Tab */}
      <div data-testid="status-tabs" className="mt-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.key || "all"}
            size="sm"
            variant={statusFilter === tab.key ? "default" : "outline"}
            data-testid={`status-tab-${tab.key || "all"}`}
            aria-pressed={statusFilter === tab.key}
            onClick={() => selectStatus(tab.key)}
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
            placeholder="Search by name or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="pl-9"
          />
        </div>
        <Button data-testid="search-btn" variant="secondary" onClick={applyFilters}>
          Search
        </Button>
        <Button data-testid="reset-btn" variant="ghost" onClick={resetFilters}>
          Reset
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
        <ReviewSkeleton />
      ) : items.length === 0 ? (
        <div
          data-testid="empty"
          className="mt-4 flex flex-col items-center justify-center rounded-12 border border-dashed border-border-strong px-6 py-14 text-center"
        >
          <p className="text-13 font-medium text-foreground">No pending or approved items</p>
          <p className="mt-1 text-13 text-muted-foreground">Adjust the filters and try again.</p>
        </div>
      ) : (
        <div data-testid="review-list" className="mt-4 space-y-3">
          {items.map((it) => (
            <article
              key={it.id}
              data-testid={`review-item-${it.id}`}
              className="rounded-12 border border-border p-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-14 font-semibold text-foreground">{it.name}</span>
                    <Badge
                      data-testid={`review-status-${it.id}`}
                      variant={it.status === "approved" ? "default" : "secondary"}
                    >
                      {it.status === "approved" ? "APPROVED" : "PENDING"}
                    </Badge>
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
                  {it.status === "pending" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        data-testid={`approve-${it.id}`}
                        onClick={() => setPending({ item: it, action: "approve" })}
                        className={cn("gap-1.5")}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`reject-${it.id}`}
                        onClick={() => setPending({ item: it, action: "reject" })}
                        className="gap-1.5"
                      >
                        <ShieldX className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`revoke-${it.id}`}
                      onClick={() => setPending({ item: it, action: "revoke" })}
                      className="gap-1.5"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Revoke approval
                    </Button>
                  )}
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
            Page {page} / {totalPages} · {total} items total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              data-testid="prev-page"
              disabled={page <= 1}
              onClick={() => goPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              data-testid="next-page"
              disabled={page >= totalPages}
              onClick={() => goPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {pending && (
        <ConfirmReviewModal
          item={pending.item}
          action={pending.action}
          onClose={() => setPending(null)}
          onConfirmed={onReviewed}
        />
      )}
    </div>
  );
}
