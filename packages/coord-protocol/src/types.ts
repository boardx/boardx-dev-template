// coord 协议 v0.1 类型定义。权威规格：docs/coord-platform/protocol/*.md
// 本文件与规格同 PR 演进；wire format 变更必须登记 protocol/CHANGELOG.md。

export const PROTOCOL = "coord/0.1" as const;

// ---------- Lease ----------

export type ResourceType = "feature" | "issue" | "coordinator-role" | "module" | "custom";

export type LeaseStatus = "in_progress" | "released" | "expired";

export const LEASE_TTL_DEFAULT_SECONDS = 21600; // 6h，沿用 LEASE_TTL 惯例
export const LEASE_TTL_MAX_SECONDS = 86400;
export const HANDOFF_NOTE_MIN_LENGTH = 10;

export interface ClaimRequest {
  protocol: typeof PROTOCOL;
  resource_id: string;
  resource_type: ResourceType;
  agent_id: string;
  ttl_seconds?: number;
}

export interface Lease {
  protocol: typeof PROTOCOL;
  lease_id: string;
  resource_id: string;
  resource_type: ResourceType;
  agent_id: string;
  status: LeaseStatus;
  claimed_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
  expires_at: string;
  handoff_note?: string; // released/expired 后必有
}

export interface HeartbeatRequest {
  protocol: typeof PROTOCOL;
  agent_id: string;
}

export interface ReleaseRequest {
  protocol: typeof PROTOCOL;
  agent_id: string;
  handoff_note: string; // ≥10 字符，缺失/过短 → 422
}

export interface LeaseConflict {
  protocol: typeof PROTOCOL;
  error: "resource_claimed";
  holder: Pick<Lease, "lease_id" | "agent_id" | "claimed_at" | "last_heartbeat_at" | "expires_at">;
}

// ---------- Evidence ----------

export interface Attestation {
  command: string;
  exit_code: number;
  output_digest: string; // sha256:<hex>
  output_excerpt: string; // 必须含真实输出片段，裸时间戳不是证据
  log_url: string;
}

export interface EvidenceManifest {
  protocol: typeof PROTOCOL;
  manifest_id: string;
  resource_id: string;
  agent_id: string;
  head_sha: string; // 声明锚定 commit（P23 postmortem 铁律）
  attestations: Attestation[];
  attested_at: string;
}

export type VerifierKind = "independent-rerun" | "reviewer-attest" | "ci";

export interface VerdictCheck {
  command: string;
  claimed_exit: number;
  rerun_exit: number;
  match: boolean;
}

export interface VerificationVerdict {
  protocol: typeof PROTOCOL;
  verdict_id: string;
  manifest_id: string;
  resource_id: string;
  verifier: { kind: VerifierKind; agent_id: string };
  head_sha: string; // 与 manifest 不一致 → verdict 无效
  verified: boolean;
  checks: VerdictCheck[];
  notes: string; // verified=false 时必填
  verified_at: string;
}

// ---------- Events + Andon ----------

export const EVENT_TYPES = [
  "lease.claimed",
  "lease.heartbeat",
  "lease.released",
  "lease.expired",
  "evidence.submitted",
  "evidence.verdict",
  "review.verdict",
  "merge.completed",
  "andon.raised",
  "andon.cleared",
  "mirror.updated",
  // coord/0.1.1（F10 前置）：tasks 收件箱迁入 RepoHub，派工状态机四事件。
  // 语义承接 coord-service D1 events 的 task-dispatch/ack/done/recall（#614/#631）。
  "task.dispatched",
  "task.acked",
  "task.completed",
  "task.recalled",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface CoordEvent<P = Record<string, unknown>> {
  protocol: typeof PROTOCOL;
  event_id: string; // ULID，单仓内严格递增
  type: EventType;
  repo: string; // "owner/name"
  resource_id: string;
  agent_id: string;
  at: string;
  payload: P;
}

export type AndonScope = "repo" | `module:${string}`;

export interface AndonPayload {
  scope: AndonScope;
  reason: string; // 必填，须含可查证锚点（issue/事件链接）
  severity: "stop-merge";
}

// ---------- Tasks（coord/0.1.1：派工收件箱，语义等价 coord-service 0002_tasks.sql） ----------

export type TaskStatus = "pending" | "acked" | "done" | "recalled";
export type TaskPriority = "high" | "normal" | "low";

export const TASK_NOTE_MAX_LENGTH = 2000; // #631：派工附言不是日志倾倒场

/** task.dispatched 的 payload 要点；task.acked/completed/recalled 仅需 task_id。 */
export interface TaskDispatchedPayload {
  task_id: number;
  assignee: string;
  priority: TaskPriority;
  deadline: string | null;
  note: string | null;
}

// ---------- 校验结果 ----------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
