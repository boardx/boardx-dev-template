export interface Env {
  DB: D1Database;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string; // "owner/repo"
}

export type ClaimStatus = "in_progress" | "released" | "expired";
export type EventType = "claim" | "heartbeat" | "release" | "expire" | "verdict" | "merge";
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

export interface VerdictRow {
  id: number;
  pr_ref: string;
  reviewer_kind: string;
  agent_id: string;
  verdict: VerdictResult;
  notes: string | null;
  at: string;
}
