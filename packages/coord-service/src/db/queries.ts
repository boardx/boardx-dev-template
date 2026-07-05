import type {
  AgentRow,
  ClaimRow,
  ClaimStatus,
  EventRow,
  EventType,
  VerdictResult,
  VerdictRow,
} from "./types";

export async function findAgentByTokenHash(db: D1Database, tokenHash: string): Promise<AgentRow | null> {
  const row = await db
    .prepare("SELECT * FROM agents WHERE token_hash = ? AND active = 1")
    .bind(tokenHash)
    .first<AgentRow>();
  return row ?? null;
}

export async function getAgent(db: D1Database, id: string): Promise<AgentRow | null> {
  const row = await db.prepare("SELECT * FROM agents WHERE id = ?").bind(id).first<AgentRow>();
  return row ?? null;
}

/** The atomic claim: a single INSERT. A UNIQUE-index conflict on `uq_active_claim`
 *  IS the "already claimed" answer — callers must catch that (see errors.ts
 *  isUniqueConstraintError) rather than pre-checking with a SELECT, which would
 *  reintroduce the exact race this table exists to close. */
export async function insertClaim(
  db: D1Database,
  params: { resourceId: string; resourceType: string; agentId: string; ttlSeconds: number; at: string }
): Promise<ClaimRow> {
  const row = await db
    .prepare(
      `INSERT INTO claims (resource_id, resource_type, agent_id, status, claimed_at, last_heartbeat_at, ttl_seconds)
       VALUES (?, ?, ?, 'in_progress', ?, ?, ?)
       RETURNING *`
    )
    .bind(params.resourceId, params.resourceType, params.agentId, params.at, params.at, params.ttlSeconds)
    .first<ClaimRow>();
  if (!row) throw new Error("insert_claim_no_row_returned");
  return row;
}

export async function getClaimById(db: D1Database, id: number): Promise<ClaimRow | null> {
  const row = await db.prepare("SELECT * FROM claims WHERE id = ?").bind(id).first<ClaimRow>();
  return row ?? null;
}

export async function heartbeatClaim(
  db: D1Database,
  id: number,
  agentId: string,
  at: string
): Promise<ClaimRow | null> {
  const row = await db
    .prepare(
      `UPDATE claims SET last_heartbeat_at = ?
       WHERE id = ? AND agent_id = ? AND status = 'in_progress'
       RETURNING *`
    )
    .bind(at, id, agentId)
    .first<ClaimRow>();
  return row ?? null;
}

export async function releaseClaim(
  db: D1Database,
  id: number,
  agentId: string,
  at: string
): Promise<ClaimRow | null> {
  const row = await db
    .prepare(
      `UPDATE claims SET status = 'released', released_at = ?
       WHERE id = ? AND agent_id = ? AND status = 'in_progress'
       RETURNING *`
    )
    .bind(at, id, agentId)
    .first<ClaimRow>();
  return row ?? null;
}

export async function listClaims(
  db: D1Database,
  filters: { resourceType?: string; resourceId?: string; status?: ClaimStatus }
): Promise<ClaimRow[]> {
  const conditions: string[] = [];
  const args: unknown[] = [];
  if (filters.resourceType) {
    conditions.push("resource_type = ?");
    args.push(filters.resourceType);
  }
  if (filters.resourceId) {
    conditions.push("resource_id = ?");
    args.push(filters.resourceId);
  }
  if (filters.status) {
    conditions.push("status = ?");
    args.push(filters.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { results } = await db
    .prepare(`SELECT * FROM claims ${where} ORDER BY id DESC`)
    .bind(...args)
    .all<ClaimRow>();
  return results;
}

/** Sweeps stale in_progress claims to 'expired' in one atomic statement, returning
 *  exactly the rows that changed (via RETURNING) so the caller can emit matching
 *  `events` rows without a second read that could race against a concurrent claim. */
export async function expireStaleClaims(db: D1Database, referenceNowIso: string): Promise<ClaimRow[]> {
  const { results } = await db
    .prepare(
      `UPDATE claims SET status = 'expired'
       WHERE status = 'in_progress'
         AND (unixepoch(?) - unixepoch(last_heartbeat_at)) > ttl_seconds
       RETURNING *`
    )
    .bind(referenceNowIso)
    .all<ClaimRow>();
  return results;
}

export async function insertEvent(
  db: D1Database,
  params: { type: EventType; resourceId: string; agentId: string; payload?: unknown; at: string }
): Promise<void> {
  await db
    .prepare("INSERT INTO events (type, resource_id, agent_id, payload, at) VALUES (?, ?, ?, ?, ?)")
    .bind(
      params.type,
      params.resourceId,
      params.agentId,
      params.payload === undefined ? null : JSON.stringify(params.payload),
      params.at
    )
    .run();
}

export async function listRecentEvents(db: D1Database, limit: number): Promise<EventRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM events ORDER BY id DESC LIMIT ?")
    .bind(limit)
    .all<EventRow>();
  return results;
}

export async function listEventsSince(db: D1Database, afterId: number, limit: number): Promise<EventRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM events WHERE id > ? ORDER BY id ASC LIMIT ?")
    .bind(afterId, limit)
    .all<EventRow>();
  return results;
}

export async function insertVerdict(
  db: D1Database,
  params: {
    prRef: string;
    reviewerKind: string;
    agentId: string;
    verdict: VerdictResult;
    notes?: string;
    at: string;
  }
): Promise<VerdictRow> {
  const row = await db
    .prepare(
      `INSERT INTO verdicts (pr_ref, reviewer_kind, agent_id, verdict, notes, at)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(params.prRef, params.reviewerKind, params.agentId, params.verdict, params.notes ?? null, params.at)
    .first<VerdictRow>();
  if (!row) throw new Error("insert_verdict_no_row_returned");
  return row;
}

const PROJECTOR_CURSOR_KEY = "last_event_id";

export async function getProjectorCursor(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM projector_state WHERE key = ?")
    .bind(PROJECTOR_CURSOR_KEY)
    .first<{ value: string }>();
  return row ? Number(row.value) : 0;
}

export async function setProjectorCursor(db: D1Database, eventId: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO projector_state (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .bind(PROJECTOR_CURSOR_KEY, String(eventId))
    .run();
}
