export interface Env {
  DB: D1Database;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string; // "owner/repo"
}

export type ClaimStatus = "in_progress" | "released" | "expired";
export type EventType =
  | "claim"
  | "heartbeat"
  | "release"
  | "expire"
  | "verdict"
  | "merge"
  // 叙述层事件（ADR-009 后 GitHub 协调面退役，站会/停线信号迁到 D1）：
  // cycle-plan/cycle-result = C-cycle 周期站会；andon = main 打挂的停线/恢复信号。
  | "cycle-plan"
  | "cycle-result"
  | "andon"
  // 派工原语生命周期（#594 平台中立任务收件箱）——由 /tasks 路由内部写入，
  // 不在 POST /events 的手写白名单里：
  | "task-dispatch"
  | "task-ack"
  | "task-done"
  | "task-recall"
  // 自助 token 领取/轮换（ADR-011 P2）——仅 /agents/:id/mint-token 内部写入：
  | "token-mint";
export type VerdictResult = "ok" | "changes";

export interface AgentRow {
  id: string;
  kind: string;
  areas: string | null;
  token_hash: string;
  active: number;
  created_at: string;
}

export interface ClaimRow {
  id: number;
  resource_id: string;
  resource_type: string;
  agent_id: string;
  status: ClaimStatus;
  claimed_at: string;
  last_heartbeat_at: string;
  ttl_seconds: number;
  released_at: string | null;
}

export interface EventRow {
  id: number;
  type: EventType;
  resource_id: string;
  agent_id: string;
  payload: string | null;
  at: string;
}

export type TaskStatus = "pending" | "acked" | "done" | "recalled";

export interface TaskRow {
  id: number;
  issue: number;
  assignee: string;
  priority: string;
  deadline: string | null;
  note: string | null;
  status: TaskStatus;
  created_by: string;
  created_at: string;
  acked_at: string | null;
  updated_at: string;
}

export interface VerdictRow {
  id: number;
  pr_ref: string;
  reviewer_kind: string;
  agent_id: string;
  verdict: VerdictResult;
  notes: string | null;
  at: string;
}
