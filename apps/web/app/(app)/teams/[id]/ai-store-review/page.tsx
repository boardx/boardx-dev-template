"use client";
// apps/web/app/(app)/teams/[id]/ai-store-review/page.tsx — P11 F06 团队 AI Store 审核 + 精选
// （uc-ai-store-006）。Team 管理角色（owner/admin）查看本团队 PENDING 队列，批准/拒绝/撤回；
// 对已批准（published）项目切换团队精选。门控全部由服务端路由承担（GET/POST 非管理角色一律
// 403）——本页对 403/401 统一展示无权限态，不在客户端渲染任何审核操作作为“看不到审核入口”的
// 兜底（即使直接访问 URL，非管理角色也只看到无权限提示，拿不到列表数据）。
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReviewWorkspace } from "../../../ai-store/_components/review-workspace";

type StoreStatus = "draft" | "published" | "pending" | "approved" | "rejected";
type ReviewAction = "approve" | "reject" | "withdraw";

interface StoreItem {
  id: number;
  name: string;
  description: string;
  author: string;
  tags: string[];
  status: StoreStatus;
  featured: boolean;
}

type Gate = "loading" | "unauthenticated" | "forbidden" | "ok";

const TAG_FILLS = ["bg-tag-green", "bg-tag-blue", "bg-tag-purple", "bg-tag-pink", "bg-tag-yellow"];
function fillFor(id: number | string) {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TAG_FILLS[h % TAG_FILLS.length];
}

interface ConfirmState {
  itemId: number;
  action: ReviewAction | "toggle-featured";
  nextFeatured?: boolean;
}

const ACTION_LABEL: Record<ReviewAction, string> = {
  approve: "通过审核",
  reject: "拒绝",
  withdraw: "撤回",
};

export default function TeamAiStoreReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = Number(params.id);

  const [gate, setGate] = useState<Gate>("loading");
  const [pending, setPending] = useState<StoreItem[]>([]);
  const [approved, setApproved] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [reviewRes, featuredRes] = await Promise.all([
        fetch(`/api/teams/${teamId}/ai-store-review`),
        fetch(`/api/teams/${teamId}/ai-store-featured`),
      ]);
      if (reviewRes.status === 401 || featuredRes.status === 401) {
        setGate("unauthenticated");
        setLoading(false);
        router.replace("/login");
        return;
      }
      if (reviewRes.status === 403 || featuredRes.status === 403) {
        setGate("forbidden");
        setLoading(false);
        return;
      }
      if (!reviewRes.ok || !featuredRes.ok) {
        setError("加载失败，请稍后重试");
        setGate("ok");
        setLoading(false);
        return;
      }
      const reviewData = (await reviewRes.json()) as { items: StoreItem[] };
      const featuredData = (await featuredRes.json()) as { items: StoreItem[] };
      setPending(reviewData.items ?? []);
      setApproved(featuredData.items ?? []);
      setGate("ok");
    } catch {
      setError("加载失败，请稍后重试");
      setGate("ok");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (Number.isFinite(teamId)) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  function askReview(itemId: number, action: ReviewAction) {
    setMessage("");
    setConfirm({ itemId, action });
  }

  function askToggleFeatured(itemId: number, nextFeatured: boolean) {
    setMessage("");
    setConfirm({ itemId, action: "toggle-featured", nextFeatured });
  }

  async function runReviewAction(itemId: number, action: ReviewAction) {
    setBusyId(itemId);
    setError("");
    try {
      const res = await fetch(`/api/teams/${teamId}/ai-store-review/${itemId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "操作失败，请重试");
        setBusyId(null);
        return;
      }
      setMessage(
        action === "approve" ? "已通过审核" : action === "reject" ? "已拒绝" : "已撤回，重新进入待审队列"
      );
      await load();
    } catch {
      setError("操作失败，请重试");
    }
    setBusyId(null);
  }

  async function runToggleFeatured(itemId: number, nextFeatured: boolean) {
    setBusyId(itemId);
    setError("");
    try {
      const res = await fetch(`/api/teams/${teamId}/ai-store-featured/${itemId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ featured: nextFeatured }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "操作失败，请重试");
        setBusyId(null);
        return;
      }
      setMessage(nextFeatured ? "已设为团队精选" : "已取消团队精选");
      await load();
    } catch {
      setError("操作失败，请重试");
    }
    setBusyId(null);
  }

  async function confirmAction() {
    if (!confirm) return;
    const { itemId, action, nextFeatured } = confirm;
    setConfirm(null);
    if (action === "toggle-featured") {
      await runToggleFeatured(itemId, Boolean(nextFeatured));
    } else {
      await runReviewAction(itemId, action);
    }
  }

  const confirmItem =
    confirm != null
      ? (pending.find((it) => it.id === confirm.itemId) ?? approved.find((it) => it.id === confirm.itemId))
      : null;

  if (gate === "forbidden") {
    return (
      <div className="mx-auto max-w-2xl px-9 py-7">
        <div data-testid="team-ai-store-forbidden" role="alert" className="rounded-12 border border-border bg-surface-1 p-8 text-center">
          <h1 className="text-17 font-bold text-foreground">无权限访问</h1>
          <p className="mt-2 text-13 text-muted-foreground">该页面仅限团队管理角色（owner/admin）访问。</p>
        </div>
      </div>
    );
  }

  return (
    <ReviewWorkspace
      scope="Team review"
      title="Team approval"
      description="Review Team publishing requests and manage Team featured resources."
      onBack={() => router.push("/ai-store")}
      className="max-w-4xl"
    >
      <div className="mt-5 flex flex-col gap-6" data-testid="team-ai-store-review-page">
      {message && (
        <p data-testid="action-message" role="status" className="text-13 font-semibold text-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" data-testid="err" className="text-13 text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <div data-testid="loading" className="flex flex-col gap-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-12 bg-muted" />
          ))}
        </div>
      ) : (
        <>
          <section data-testid="review-section" className="flex flex-col gap-3">
            <h2 className="text-15 font-semibold text-foreground">审核（PENDING）</h2>
            {pending.length === 0 ? (
              <div data-testid="review-empty" className="rounded-12 border border-dashed border-border-strong py-10 text-center">
                <p className="text-13 text-muted-foreground">暂无待审核项目。</p>
              </div>
            ) : (
              <ul data-testid="review-list" className="flex flex-col gap-3">
                {pending.map((it) => (
                  <li
                    key={it.id}
                    data-testid={`review-card-${it.id}`}
                    className="flex items-start gap-3 rounded-12 border border-border p-4"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-10 text-15 font-bold text-foreground/40",
                        fillFor(it.id)
                      )}
                    >
                      {it.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-13 font-semibold text-foreground">{it.name}</div>
                      <div className="mt-0.5 text-11 text-placeholder">by {it.author}</div>
                      <p className="mt-1.5 line-clamp-2 text-12 leading-relaxed text-muted-foreground">
                        {it.description}
                      </p>
                      <span
                        data-testid={`review-status-${it.id}`}
                        className="mt-2 inline-block rounded-7 bg-muted px-2 py-0.5 text-10 font-bold text-muted-foreground"
                      >
                        PENDING
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`approve-${it.id}`}
                        disabled={busyId === it.id}
                        onClick={() => askReview(it.id, "approve")}
                      >
                        通过
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`reject-${it.id}`}
                        disabled={busyId === it.id}
                        onClick={() => askReview(it.id, "reject")}
                      >
                        拒绝
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section data-testid="featured-section" className="flex flex-col gap-3">
            <h2 className="text-15 font-semibold text-foreground">精选（已批准）</h2>
            {approved.length === 0 ? (
              <div data-testid="featured-empty" className="rounded-12 border border-dashed border-border-strong py-10 text-center">
                <p className="text-13 text-muted-foreground">暂无已批准项目。</p>
              </div>
            ) : (
              <ul data-testid="featured-list" className="flex flex-col gap-3">
                {approved.map((it) => (
                  <li
                    key={it.id}
                    data-testid={`featured-card-${it.id}`}
                    className="flex items-start gap-3 rounded-12 border border-border p-4"
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-10 text-15 font-bold text-foreground/40",
                        fillFor(it.id)
                      )}
                    >
                      {it.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-13 font-semibold text-foreground">{it.name}</span>
                        {it.featured && (
                          <span
                            data-testid={`featured-badge-${it.id}`}
                            className="shrink-0 rounded-7 bg-primary px-1.75 py-0.5 text-9 font-bold text-primary-foreground"
                          >
                            ★ FEATURED
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-12 leading-relaxed text-muted-foreground">
                        {it.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={it.featured ? "outline" : "default"}
                        data-testid={`toggle-featured-${it.id}`}
                        disabled={busyId === it.id}
                        onClick={() => askToggleFeatured(it.id, !it.featured)}
                      >
                        {it.featured ? "取消精选" : "设为精选"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        data-testid={`withdraw-${it.id}`}
                        disabled={busyId === it.id}
                        onClick={() => askReview(it.id, "withdraw")}
                      >
                        撤回审核
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {/* 项目审核确认弹窗：展示资源名称、描述等信息，确认后才真正切换状态（防误操作）。 */}
      {confirm != null && confirmItem && (
        <div
          data-testid="confirm-modal"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35"
          onClick={() => setConfirm(null)}
        >
          <div
            className="w-95 max-w-[92vw] rounded-14 bg-background p-5.5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 data-testid="confirm-title" className="text-15 font-bold text-foreground">
              {confirm.action === "toggle-featured"
                ? confirm.nextFeatured
                  ? "确认设为团队精选？"
                  : "确认取消团队精选？"
                : `确认${ACTION_LABEL[confirm.action]}？`}
            </h2>
            <div className="mt-3 rounded-10 border border-border bg-surface-1 p-3">
              <div data-testid="confirm-item-name" className="text-13 font-semibold text-foreground">
                {confirmItem.name}
              </div>
              <p data-testid="confirm-item-description" className="mt-1 text-12 text-muted-foreground">
                {confirmItem.description}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="confirm-cancel"
                onClick={() => setConfirm(null)}
              >
                取消
              </Button>
              <Button type="button" size="sm" data-testid="confirm-submit" onClick={() => void confirmAction()}>
                确认
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ReviewWorkspace>
  );
}
