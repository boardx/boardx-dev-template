// 输入快照类型（R1 影子模式，p30-F10）：全部字段直接对应 RepoHub DO 现有只读端点
// 的响应形状（GET /realtime/prs、/realtime/issues、/claims、/andon）——CoordBrain
// 不引入任何新的数据源，只是纯函数消费既有镜像/租约/andon 状态。
// 刻意用独立、结构兼容（duck-typed）的接口而非直接 import RepoHub/coord-protocol 的
// 类型：本包必须保持零 IO、零 Cloudflare Workers 运行时依赖，可在任意 JS 环境单测。

/** GitHub PR 镜像行的判定所需字段（rowToItem 的子集）。
 *  mergeable/merge_state 直接取 GitHub GraphQL 的 mergeable / mergeStateStatus——
 *  GitHub 已把「required checks 绿 + review 齐 + up-to-date」编码进 mergeStateStatus
 *  === "CLEAN"，CoordBrain 不重复计算这三者，只读这一权威字段（避免判定逻辑分裂）。 */
export interface PrSnapshot {
  number: number;
  head_sha: string | null;
  /** GitHub mergeable：MERGEABLE | CONFLICTING | UNKNOWN */
  mergeable: string | null;
  /** GitHub mergeStateStatus：CLEAN | BEHIND | BLOCKED | DIRTY | DRAFT | UNSTABLE | UNKNOWN | HAS_HOOKS */
  merge_state: string | null;
  /** PR 创建时间（ISO）。缺省时催办判定视为"不可判定"，不催办（fail-closed，宁可漏报不可误报）。 */
  opened_at?: string | null;
  labels: string[];
}

export interface IssueSnapshot {
  number: number;
  state: string; // open | closed
  labels: string[];
  assignees: string[];
}

/** 活跃租约快照（语义等价 RepoHub GET /claims 的行 / coord-protocol Lease）。 */
export interface LeaseSnapshot {
  lease_id: string;
  resource_id: string; // "issue:123" 等
  agent_id: string;
  claimed_at: string;
  last_heartbeat_at: string;
  expires_at: string;
}

export interface AndonSnapshot {
  active: boolean;
  andons: Array<{ scope: string; reason: string; raised_by?: string; raised_at?: string }>;
}

/** 模块亲和表：模块标签（如 "module:room"）→ 建议派工的 agent handle。
 *  v0 用静态表（registry.yaml 派生），不做学习/评分。 */
export type ModuleAffinity = Record<string, string>;

export interface ShadowDecisionInput {
  prs: PrSnapshot[];
  issues: IssueSnapshot[];
  leases: LeaseSnapshot[];
  andon: AndonSnapshot;
  affinity: ModuleAffinity;
  now: number; // 注入时钟，规则纯函数不读 Date.now()
}

export type ShadowRuleId =
  | "merge_ready"
  | "dispatch_suggested"
  | "pr_nudge"
  | "stale_lease_reclaim"
  | "andon_freeze";

/** 单条影子决策——「CoordBrain 将会做的事」，只读记录，从不执行。
 *  subject_id 是决策所指对象（"pr:123" / "issue:45" / "lease:lse_xxx" / "repo"）。 */
export interface ShadowDecision {
  rule: ShadowRuleId;
  subject_id: string;
  decision: boolean;
  reason: string;
  detail?: Record<string, unknown>;
}

/** 可调阈值，全部有安全默认值（对齐 requirements/coord-resident.md 的机械 SOP 描述）。 */
export interface ShadowThresholds {
  /** PR 等待多久未合并算需要催办（ms）。默认 24h，对齐"主动追踪 PR 等待时长"SOP。 */
  prNudgeMs: number;
  /** 心跳静默多久算 stale（ms）。默认 10 分钟——独立于租约硬 TTL 到期（RepoHub alarm
   *  自动处理），这是"更早"的软预警，供人核对是否要提前起草回收请求。 */
  staleHeartbeatMs: number;
  /** ready-for-dev 派工判定所需标签。语义权威：.harness/rubrics/ready-for-dev.md /
   *  .harness/instructions/multi-agent-coordination.md——仓内统一约定的标签名是
   *  "status:ready-for-dev"，不是裸 "ready-for-dev"。 */
  readyForDevLabel: string;
}

export const DEFAULT_THRESHOLDS: ShadowThresholds = {
  prNudgeMs: 24 * 3600 * 1000,
  staleHeartbeatMs: 10 * 60 * 1000,
  readyForDevLabel: "status:ready-for-dev",
};
