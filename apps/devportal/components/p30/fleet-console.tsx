"use client";
// M2 /me/agents 车队管理台（p30 UI 先行原型，UC-06 / UC-13 / D6）。
// 每 agent 一行：心跳点（复用 HeartbeatDot 语义）/ 当前项目与租约 / token 状态 / 最近事件；
// 行动：轮换 token（不可跳过确认）/ 暂停 / 退役（确认）。「＋ Enroll 新 agent」走三步向导。
// ⚠️ 全部 mock（lib/mock/p30.ts）；操作只改本地 state，feature 实现时接真实 API。
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import { ConfirmDialog } from "@/components/p30/confirm-dialog";
import { EnrollWizard } from "@/components/p30/enroll-wizard";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader, useMockLoading } from "@/components/p30/shared";
import { MOCK_FLEET, MOCK_ME, type EnrollRuntime, type MockFleetAgent } from "@/lib/mock/p30";

const HEARTBEAT_MIN = { fresh: 1, aging: 12, stale: 42 } as const;

type PendingAction = { kind: "rotate" | "retire"; agentId: string } | null;

function lifecycleBadge(a: MockFleetAgent): { label: string; variant: "success" | "muted" | "destructive" } {
  if (a.lifecycle === "paused") return { label: "已暂停", variant: "muted" };
  if (a.lifecycle === "retired") return { label: "已退役", variant: "destructive" };
  return { label: "在役", variant: "success" };
}

function FleetRow({
  a,
  onAction,
  onTogglePause,
}: {
  a: MockFleetAgent;
  onAction: (kind: "rotate" | "retire", agentId: string) => void;
  onTogglePause: (agentId: string) => void;
}) {
  const lc = lifecycleBadge(a);
  const isSub = a.id.includes(".");
  const retired = a.lifecycle === "retired";
  return (
    <li
      data-testid={`fleet-row-${a.id.replace(/[@/.]/g, "-")}`}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-10 border border-border p-3 transition-colors hover:bg-surface-1 ${retired ? "opacity-60" : ""} ${isSub ? "ml-6 border-l-4 border-l-tag-purple" : ""}`}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
        <HeartbeatDot minutes={HEARTBEAT_MIN[a.heartbeat]} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <IdentityChip kind="agent" className="min-w-0 truncate font-mono">{a.id}</IdentityChip>
            {isSub && <span className="text-11 text-muted-foreground">sub</span>}
          </div>
          <p className="mt-1 truncate text-12 text-muted-foreground" title={a.lastEvent}>
            {a.lastEvent}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 basis-40">
        {a.projectSlug ? <IdentityChip kind="project">{a.projectSlug}</IdentityChip> : <span className="text-12 text-muted-foreground">未授权项目</span>}
        <span className="text-11 text-muted-foreground">{a.lease ?? "无租约（空闲）"}</span>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1">
        <Badge variant={lc.variant} className="text-11">{lc.label}</Badge>
        <span className={`text-11 ${a.tokenStatus === "健康" ? "text-muted-foreground" : "text-destructive"}`}>token：{a.tokenStatus}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-11 text-muted-foreground">{a.runtime}</span>
        <Button size="sm" variant="outline" data-testid={`action-rotate-${a.id.replace(/[@/.]/g, "-")}`} disabled={retired} onClick={() => onAction("rotate", a.id)}>
          轮换 token
        </Button>
        <Button size="sm" variant="outline" disabled={retired} data-testid={`action-pause-${a.id.replace(/[@/.]/g, "-")}`} onClick={() => onTogglePause(a.id)}>
          {a.lifecycle === "paused" ? "恢复" : "暂停"}
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" disabled={retired} data-testid={`action-retire-${a.id.replace(/[@/.]/g, "-")}`} onClick={() => onAction("retire", a.id)}>
          退役
        </Button>
      </div>
    </li>
  );
}

export function FleetConsole() {
  const loading = useMockLoading();
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [fleet, setFleet] = useState<readonly MockFleetAgent[]>(MOCK_FLEET);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const rows = emptyDemo ? [] : fleet;
  const myShortNames = fleet.map((a) => a.id.replace(`@${MOCK_ME.handle}/`, "").split(".")[0] ?? "");

  const togglePause = (agentId: string): void => {
    setFleet((cur) => cur.map((a) => (a.id === agentId ? { ...a, lifecycle: a.lifecycle === "paused" ? "active" : "paused" } : a)));
  };

  const applyPending = (): void => {
    if (!pending) return;
    if (pending.kind === "rotate") {
      setFleet((cur) => cur.map((a) => (a.id === pending.agentId ? { ...a, tokenStatus: "健康" } : a)));
      setNotice(`已轮换 ${pending.agentId} 的 token——旧 token 即时 401，已入审计（mock）。`);
    } else {
      setFleet((cur) => cur.map((a) => (a.id === pending.agentId ? { ...a, lifecycle: "retired", lease: null, tokenStatus: "已吊销" } : a)));
      setNotice(`${pending.agentId} 已退役——token 已吊销，档案与归因保留（mock）。`);
    }
    setPending(null);
  };

  const onEnrollDone = (fullId: string, runtime: EnrollRuntime): void => {
    setFleet((cur) => [
      ...cur,
      {
        id: fullId,
        runtime,
        heartbeat: "fresh",
        heartbeatMin: 0,
        lifecycle: "active",
        projectSlug: null,
        lease: null,
        tokenStatus: "健康",
        lastEvent: "刚刚 · 首个心跳（enroll 完成）",
      },
    ]);
    setWizardOpen(false);
    setNotice(`${fullId} 已加入车队 🎉`);
  };

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9">
      <PrototypeHeader
        title="我的 agent 车队"
        subtitle={`👤 @${MOCK_ME.handle} 名下 ${fleet.length} 个 agent · enroll 即生效无审批（D2）· 标识 @handle/agent-name（D6）`}
        emptyDemo={emptyDemo}
        onToggleEmptyDemo={() => setEmptyDemo((v) => !v)}
      />

      {notice && (
        <p data-testid="fleet-notice" role="status" className="rounded-10 border border-success/40 bg-tag-green/50 px-3 py-2 text-13 text-foreground transition-opacity">
          {notice}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-13 text-muted-foreground">心跳语义：🟢 &lt;5min 新鲜 · 🟡 &lt;30min 渐旧 · 🔴 ≥30min 陈旧（悬停看时间）</p>
        <Button data-testid="enroll-open" onClick={() => setWizardOpen(true)}>
          ＋ Enroll 新 agent
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState testid="fleet-empty">
          你还没有 agent——点右上「＋ Enroll 新 agent」，三步完成接入（这也是 onboarding 第 ② 步）。
        </EmptyState>
      ) : (
        <ul data-testid="fleet-list" className="space-y-2">
          {rows.map((a) => (
            <FleetRow key={a.id} a={a} onAction={(kind, agentId) => setPending({ kind, agentId })} onTogglePause={togglePause} />
          ))}
        </ul>
      )}

      {wizardOpen && <EnrollWizard existingNames={myShortNames} onDone={onEnrollDone} onCancel={() => setWizardOpen(false)} />}

      {pending?.kind === "rotate" && (
        <ConfirmDialog
          testid="rotate-confirm"
          title="轮换 token"
          body={`将为 ${pending.agentId} 签发新 scoped token，旧 token 即时 401（正在跑的任务会中断）。动作入只增审计并双写 GitHub issue。`}
          confirmLabel="确认轮换"
          requireText={pending.agentId}
          onConfirm={applyPending}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.kind === "retire" && (
        <ConfirmDialog
          testid="retire-confirm"
          title="退役 agent"
          body={`${pending.agentId} 将被退役：吊销 token、释放租约；历史贡献与归因档案保留（数字分身页仍可见）。此操作不可逆。`}
          confirmLabel="确认退役"
          requireText={pending.agentId}
          destructive
          onConfirm={applyPending}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
