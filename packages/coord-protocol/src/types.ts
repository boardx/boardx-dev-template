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
  // coord/0.1.2（p30/F01）：平台目录 DO（PlatformDirectory）审计事件。
  // 目录写路径仅限身份/授权/审批/派工（三条铁律），每次写都 emit 一条——
  // 「一切身份/授权/审批动作入只增审计」（p30 需求 N5）。加法扩展，wire tag 不动。
  "directory.project.registered",
  "directory.engineer.upserted",
  "directory.membership.requested",
  "directory.membership.transitioned",
  "directory.agent.enrolled",
  "directory.agent.updated",
  "directory.agent.heartbeat",
  "directory.enrollment.created",
  "directory.enrollment.revoked",
  // coord/0.1.3（p30/F04）：工作区数据按项目分片入 RepoHub DO——需求流水线 /
  // sprint 面板 / talk 对话流三类写操作的事件。加法扩展，wire tag 不动（同 0.1.1 先例）。
  "requirement.submitted",
  "requirement.advanced",
  "requirement.dispatched",
  "requirement.rejected",
  "sprint.upserted",
  "talk.posted",
  // coord/0.1.4（p30/F09）：三层意图消息协议 v1（UC-11）。
  // 上行 sub→module→coord→👤（progress/blocker→escalate→decide 待拍板）；
  // 下行 👤→coord→module→sub（assign 广播→accept 自动继续）。加法扩展，wire tag 不动。
  "intent.assign",
  "intent.accept",
  "intent.progress",
  "intent.blocker",
  "intent.escalate",
  "intent.decide",
  // coord/0.1.5（p30/F07）：agent 生命周期（enroll 向导「轮换/暂停/退役」的暂停/
  // 恢复/退役面，轮换只动 RepoHub token 不改本状态，退役是终态）。
  "directory.agent.lifecycle_changed",
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

// ---------- Workspace（coord/0.1.3：p30/F04 工作区数据按项目分片） ----------
// 需求流水线五态：提交 → 分析 → 审核 → 下发（happy path 四段），rejected 为审核拒绝终态。
// dispatched / rejected 均为终态；状态推进只许前向，非法迁移 409。

export const REQUIREMENT_STATUSES = [
  "submitted",
  "analyzing",
  "in_review",
  "dispatched",
  "rejected",
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export const REQUIREMENT_TITLE_MAX_LENGTH = 300;
export const REQUIREMENT_BODY_MAX_LENGTH = 10000;
export const TALK_BODY_MAX_LENGTH = 4000; // 对话流不是日志倾倒场（同 TASK_NOTE 纪律）

// ---------- Intents（coord/0.1.4：三层意图消息协议 v1，events.md §Intents） ----------
// 六类意图消息＝一类特殊事件（type 前缀 `intent.`），payload 按类型强校验（validate.ts
// intentPayloadErrors）。GitHub issue 双写、GET /intents 聚合、闭环状态推导见
// docs/coord-platform/protocol/intents.md（语义权威）。

export const INTENT_TYPES = [
  "intent.assign",
  "intent.accept",
  "intent.progress",
  "intent.blocker",
  "intent.escalate",
  "intent.decide",
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export type IntentDecision = "approved" | "rejected" | "changes_requested";

/** intent.assign：下行广播，target_resource_id 复用 resource_id 命名规则（lease.md）。 */
export interface IntentAssignPayload {
  target_agent_id: string;
  target_resource_id: string;
  note: string | null;
}

/** intent.accept：接收方确认收到 assign，闭合下行一环。 */
export interface IntentAcceptPayload {
  note: string | null;
}

/** intent.progress：上行进度汇报，无阻断语义。 */
export interface IntentProgressPayload {
  summary: string;
}

/** intent.blocker：上行卡点，reason 与 andon 同规格（≥10 字符，须含可查证锚点）。 */
export interface IntentBlockerPayload {
  reason: string;
}

/** intent.escalate：上行升级至人类拍板点，线程进入「等待拍板」。 */
export interface IntentEscalatePayload {
  reason: string;
  escalated_to: string | null;
}

/** intent.decide：人类拍板，闭合上行一环。issue_ref 是可查证锚点（P23 postmortem 铁律
 *  的同款要求：拍板不能是裸口头承诺）；gateway 层要求 COORD_ADMIN_TOKEN 才能发起，防伪造。 */
export interface IntentDecidePayload {
  reason: string;
  issue_ref: string; // "#123" 或 "owner/repo#123"
  decision: IntentDecision | null;
}

export type ThreadStatus = "open" | "awaiting_decision" | "closed";

// ---------- 校验结果 ----------

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}
