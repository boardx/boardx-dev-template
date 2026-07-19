"use client";
// M2 /me/agents 车队管理台——接真（p30/F07，UC-06 / UC-13 / D6）。
// 数据源：GET /api/portal/my-agents（Directory 身份 + RepoHub token 健康态交叉）。
// 每 agent 一行：心跳点 / 当前项目 / token 状态 / 最近心跳；行动：轮换 token（不可
// 跳过确认，即时 401 旧 token）/ 暂停·恢复 / 退役（确认，即时吊销全部在役 token）。
// 「＋ Enroll 新 agent」走三步向导（enroll-wizard.tsx，真实 mint-on-reveal）。
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeartbeatDot } from "@/components/portal/heartbeat-dot";
import { ConfirmDialog } from "@/components/p30/confirm-dialog";
import { EnrollWizard } from "@/components/p30/enroll-wizard";
import { EmptyState, IdentityChip, LoadingSkeleton, PrototypeHeader } from "@/components/p30/shared";

const HEARTBEAT_MIN = { fresh: 1, aging: 12, stale: 42, none: 0 } as const;

type FleetHeartbeat = keyof typeof HEARTBEAT_MIN;
type FleetLifecycle = "active" | "paused" | "retired";

interface FleetAgent {
  id: string; // @handle/agent-name（identifier）
  agentId: string; // agt_ULID
  runtime: string;
  heartbeat: FleetHeartbeat;
  heartbeatMin: number | null;
  lifecycle: FleetLifecycle;
  projectSlug: string | null;
  tokenStatus: "健康" | "已吊销" | "未发放";
}

type PendingAction = { kind: "rotate" | "retire"; agent: FleetAgent } | null;

function lifecycleBadge(a: FleetAgent): { label: string; variant: "success" | "muted" | "destructive" } {
  if (a.lifecycle === "paused") return { label: "已暂停", variant: "muted" };
  if (a.lifecycle === "retired") return { label: "已退役", variant: "destructive" };
  return { label: "在役", variant: "success" };
}

function testSafe(id: string): string {
  return id.replace(/[@/.]/g, "-");
}

function FleetRow({
  a,
  onAction,
  onTogglePause,
  busy,
}: {
  a: FleetAgent;
  onAction: (kind: "rotate" | "retire", agent: FleetAgent) => void;
  onTogglePause: (agent: FleetAgent) => void;
  busy: boolean;
}) {
  const lc = lifecycleBadge(a);
  const isSub = a.id.includes(".");
  const retired = a.lifecycle === "retired";
  return (
    <li
      data-testid={`fleet-row-${testSafe(a.id)}`}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-10 border border-border p-3 transition-colors hover:bg-surface-1 ${retired ? "opacity-60" : ""} ${isSub ? "ml-6 border-l-4 border-l-tag-purple" : ""}`}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
        <HeartbeatDot minutes={HEARTBEAT_MIN[a.heartbeat]} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <IdentityChip kind="agent" className="min-w-0 truncate font-mono">{a.id}</IdentityChip>
            {isSub && <span className="text-11 text-muted-foreground">sub</span>}
          </div>
          <p className="mt-1 truncate text-12 text-muted-foreground">
            {a.heartbeat === "none" ? "尚无心跳" : `最近心跳 ${a.heartbeatMin ?? 0} 分钟前`}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1 basis-40">
        {a.projectSlug ? <IdentityChip kind="project">{a.projectSlug}</IdentityChip> : <span className="text-12 text-muted-foreground">未授权项目</span>}
      </div>
      <div className="flex shrink-0 flex-col items-start gap-1">
        <Badge variant={lc.variant} className="text-11">{lc.label}</Badge>
        <span className={`text-11 ${a.tokenStatus === "健康" ? "text-muted-foreground" : "text-destructive"}`}>token：{a.tokenStatus}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-11 text-muted-foreground">{a.runtime}</span>
        <Button size="sm" variant="outline" data-testid={`action-rotate-${testSafe(a.id)}`} disabled={retired || busy} onClick={() => onAction("rotate", a)}>
          轮换 token
        </Button>
        <Button size="sm" variant="outline" disabled={retired || busy} data-testid={`action-pause-${testSafe(a.id)}`} onClick={() => onTogglePause(a)}>
          {a.lifecycle === "paused" ? "恢复" : "暂停"}
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" disabled={retired || busy} data-testid={`action-retire-${testSafe(a.id)}`} onClick={() => onAction("retire", a)}>
          退役
        </Button>
      </div>
    </li>
  );
}

export function FleetConsole() {
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState<string | null>(null);
  const [fleet, setFleet] = useState<readonly FleetAgent[]>([]);
  const [configured, setConfigured] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/portal/my-agents", { cache: "no-store" });
      const body = (await res.json()) as { configured: boolean; handle?: string; fleet?: FleetAgent[] };
      setConfigured(body.configured);
      if (body.handle) setHandle(body.handle);
      setFleet(body.fleet ?? []);
    } catch {
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const myShortNames = fleet.map((a) => a.id.replace(handle ? `@${handle}/` : "", "").split(".")[0] ?? "");

  const togglePause = async (agent: FleetAgent): Promise<void> => {
    setBusyId(agent.agentId);
    try {
      const action = agent.lifecycle === "paused" ? "resume" : "pause";
      const res = await fetch(`/api/portal/my-agents/${agent.agentId}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  };

  const applyPending = async (): Promise<void> => {
    if (!pending) return;
    const { kind, agent } = pending;
    setBusyId(agent.agentId);
    try {
      const res = await fetch(`/api/portal/my-agents/${agent.agentId}/${kind}`, { method: "POST" });
      if (res.ok) {
        setNotice(
          kind === "rotate"
            ? `已轮换 ${agent.id} 的 token——旧 token 即时 401，已入审计。`
            : `${agent.id} 已退役——token 已吊销，档案与归因保留。`,
        );
        await load();
      }
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  const onEnrollDone = (): void => {
    setWizardOpen(false);
    void load();
    setNotice("agent 已加入车队 🎉");
  };

  return (
    <div className="mx-auto max-w-content space-y-4 px-6 pb-14 pt-7 md:px-9">
      <PrototypeHeader
        title="我的 agent 车队"
        subtitle={`👤 ${handle ? `@${handle}` : "我"} 名下 ${fleet.length} 个 agent · enroll 即生效无审批（D2）· 标识 @handle/agent-name（D6）`}
        emptyDemo={false}
        onToggleEmptyDemo={() => undefined}
      />

      {!configured && (
        <p role="status" className="rounded-10 border border-border bg-surface-2 px-3 py-2 text-13 text-muted-foreground">
          coord-gateway 尚未接通——车队数据暂不可用（部署中间态，非故障）。
        </p>
      )}

      {notice && (
        <p data-testid="fleet-notice" role="status" className="rounded-10 border border-success/40 bg-tag-green/50 px-3 py-2 text-13 text-foreground transition-opacity">
          {notice}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-13 text-muted-foreground">心跳语义：🟢 &lt;5min 新鲜 · 🟡 &lt;30min 渐旧 · 🔴 ≥30min 陈旧（悬停看时间）</p>
        <Button data-testid="enroll-open" disabled={!handle} onClick={() => setWizardOpen(true)}>
          ＋ Enroll 新 agent
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : fleet.length === 0 ? (
        <EmptyState testid="fleet-empty">
          你还没有 agent——点右上「＋ Enroll 新 agent」，三步完成接入（这也是 onboarding 第 ② 步）。
        </EmptyState>
      ) : (
        <ul data-testid="fleet-list" className="space-y-2">
          {fleet.map((a) => (
            <FleetRow
              key={a.agentId}
              a={a}
              busy={busyId === a.agentId}
              onAction={(kind, agent) => setPending({ kind, agent })}
              onTogglePause={(agent) => void togglePause(agent)}
            />
          ))}
        </ul>
      )}

      {wizardOpen && handle && (
        <EnrollWizard handle={handle} existingNames={myShortNames} onDone={onEnrollDone} onCancel={() => setWizardOpen(false)} />
      )}

      {pending?.kind === "rotate" && (
        <ConfirmDialog
          testid="rotate-confirm"
          title="轮换 token"
          body={`将为 ${pending.agent.id} 签发新 scoped token，旧 token 即时 401（正在跑的任务会中断）。动作入只增审计并双写 GitHub issue。`}
          confirmLabel="确认轮换"
          requireText={pending.agent.id}
          onConfirm={() => void applyPending()}
          onCancel={() => setPending(null)}
        />
      )}
      {pending?.kind === "retire" && (
        <ConfirmDialog
          testid="retire-confirm"
          title="退役 agent"
          body={`${pending.agent.id} 将被退役：吊销 token、释放租约；历史贡献与归因档案保留（数字分身页仍可见）。此操作不可逆。`}
          confirmLabel="确认退役"
          requireText={pending.agent.id}
          destructive
          onConfirm={() => void applyPending()}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
