"use client";
// DispatchPanel — 门户派工看板（#594 P3）：全队任务队列 +（有资格者）派工表单。
// 数据源 /api/portal/dispatch（服务端 broker 代调 coord-service）。无派工资格的人
// 只看队列不显示表单；broker/队列未配置 → 诚实降级提示，不虚构。
import { useEffect, useState, useCallback } from "react";
import { portalFetch } from "@/lib/portal-fetch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PortalCard } from "@/components/portal/portal-card";

interface Assignable { id: string; kind: string; owner: string | null; is_mine: boolean }
interface Task {
  id: number; issue: number; assignee: string; priority: string;
  status: string; note: string | null; created_by: string; acked_at: string | null;
}
interface DispatchData {
  can_dispatch: boolean; broker_configured: boolean; queue_configured: boolean;
  assignable: Assignable[]; tasks: Task[];
}

const STATUS_BADGE: Record<string, { label: string; variant: "outline" | "muted" | "destructive" }> = {
  pending: { label: "待接", variant: "outline" },
  acked: { label: "已接", variant: "muted" },
  done: { label: "完成", variant: "muted" },
  recalled: { label: "已撤", variant: "destructive" },
};

export function DispatchPanel() {
  const [data, setData] = useState<DispatchData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "degraded">("loading");
  const [form, setForm] = useState({ issue: "", assignee: "", priority: "normal", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await portalFetch("/api/portal/dispatch");
      if (!res) return;
      if (!res.ok) { setState("degraded"); return; }
      setData((await res.json()) as DispatchData);
      setState("ready");
    } catch { setState("degraded"); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function dispatch() {
    if (!form.issue || !form.assignee) { setMsg("请填 issue 号并选择 agent"); return; }
    setBusy(true); setMsg(null);
    try {
      const res = await portalFetch("/api/portal/dispatch");
      if (!res) return;
      const post = await fetch("/api/portal/dispatch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue: Number(form.issue), assignee: form.assignee, priority: form.priority, note: form.note }),
      });
      if (post.ok) {
        setMsg(`已派工 issue #${form.issue} → ${form.assignee}`);
        setForm({ issue: "", assignee: "", priority: "normal", note: "" });
        void load();
      } else {
        const b = (await post.json().catch(() => ({}))) as { error?: string; upstream?: string };
        setMsg(`派工失败：${b.upstream ?? b.error ?? post.status}`);
      }
    } finally { setBusy(false); }
  }

  async function recall(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/portal/dispatch/${id}/recall`, { method: "POST" });
      if (res.ok) void load(); else setMsg(`撤回失败`);
    } finally { setBusy(false); }
  }

  if (state === "loading") return <PortalCard state="loading" title="派工看板"><span /></PortalCard>;
  if (state === "degraded" || !data) return <PortalCard state="degraded" title="派工看板"><span /></PortalCard>;

  const active = data.tasks.filter((t) => t.status === "pending" || t.status === "acked");

  return (
    <PortalCard state="ready" title="派工看板" wide>
      {/* 派工表单：仅有资格者可见（own 协调者身份），符合"人类身份映射" */}
      {data.can_dispatch ? (
        !data.broker_configured ? (
          <p className="mb-3 text-11 text-muted-foreground">派工 broker 未接线（COORD_DISPATCH_TOKEN 未配置）。</p>
        ) : (
          <div className="mb-4 grid grid-cols-1 gap-2 rounded-8 border border-border bg-surface-2 p-3 md:grid-cols-[7rem_1fr_6rem_auto]" data-testid="dispatch-form">
            <div>
              <Label htmlFor="d-issue" className="text-11">issue #</Label>
              <Input id="d-issue" value={form.issue} inputMode="numeric" placeholder="594"
                onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <div>
              <Label htmlFor="d-assignee" className="text-11">派给</Label>
              <select id="d-assignee" data-testid="dispatch-assignee"
                className="h-9 w-full rounded-8 border border-border bg-background px-2 text-13"
                value={form.assignee} onChange={(e) => setForm((f) => ({ ...f, assignee: e.target.value }))}>
                <option value="">选择 agent…</option>
                {data.assignable.map((a) => (
                  <option key={a.id} value={a.id}>{a.id}{a.is_mine ? "（我的）" : ""} · {a.kind}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="d-priority" className="text-11">优先级</Label>
              <select id="d-priority" className="h-9 w-full rounded-8 border border-border bg-background px-2 text-13"
                value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option value="high">高</option><option value="normal">中</option><option value="low">低</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button size="sm" disabled={busy} onClick={() => void dispatch()} data-testid="dispatch-submit">派工</Button>
            </div>
            <div className="md:col-span-4">
              <Input value={form.note} placeholder="附言（可选，会带上你的身份做审计）"
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
        )
      ) : (
        <p className="mb-3 text-11 text-muted-foreground">你不是协调者——只可查看队列。派工需在 registry 里 own 协调者身份。</p>
      )}
      {msg && <p className="mb-3 text-11 text-foreground" data-testid="dispatch-msg">{msg}</p>}

      {/* 全队任务队列：谁被派了什么、接没接 */}
      {!data.queue_configured ? (
        <p className="text-13 text-muted-foreground">任务队列数据源未接线。</p>
      ) : active.length === 0 ? (
        <p className="text-13 text-muted-foreground">当前没有进行中的派工。</p>
      ) : (
        <ul className="space-y-1.5" data-testid="dispatch-queue">
          {active.map((t) => {
            const b = STATUS_BADGE[t.status] ?? { label: t.status, variant: "muted" as const };
            return (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-8 px-2 py-1.5 hover:bg-muted">
                <span className="min-w-0">
                  <span className="block truncate text-13 text-foreground">
                    <a href={`https://github.com/boardx/boardx-dev-template/issues/${t.issue}`} target="_blank" rel="noopener" className="underline">#{t.issue}</a>
                    {" → "}{t.assignee}
                  </span>
                  {t.note && <span className="block truncate text-11 text-muted-foreground">{t.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={b.variant} className="text-11">{b.label}</Badge>
                  {data.can_dispatch && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-11" disabled={busy} onClick={() => void recall(t.id)}>撤回</Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PortalCard>
  );
}
