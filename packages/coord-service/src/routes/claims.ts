import { requireAgent } from "../auth";
import { HttpError, isUniqueConstraintError } from "../lib/errors";
import { nowIso } from "../lib/time";
import {
  getClaimById,
  heartbeatClaim,
  insertClaim,
  insertEvent,
  listClaims,
  releaseClaim,
} from "../db/queries";
import type { ClaimStatus, Env } from "../db/types";
import type { Handler } from "../router";

const DEFAULT_TTL_SECONDS = 21600; // 6h, matches today's LEASE_TTL convention

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) throw new HttpError(400, "invalid_body");
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `missing_field:${field}`);
  }
  return value;
}

function parseClaimIdParam(params: Record<string, string>): number {
  const raw = params["id"];
  const id = raw ? Number(raw) : NaN;
  if (!Number.isInteger(id)) throw new HttpError(400, "invalid_claim_id");
  return id;
}

/** POST /claims — the atomic claim. A single INSERT; a UNIQUE-index conflict on
 *  `uq_active_claim` means the resource is already claimed, reported as 409. This
 *  is not a check-then-act — see AGENTS.md for why that distinction matters. */
export const claimResource: Handler = async (request, env: Env) => {
  const agent = await requireAgent(request, env);
  const body: unknown = await request.json().catch(() => {
    throw new HttpError(400, "invalid_json_body");
  });
  const resourceId = requireStringField(body, "resource_id");
  const resourceType = requireStringField(body, "resource_type");
  const ttlSecondsRaw = (body as Record<string, unknown>)["ttl_seconds"];
  const ttlSeconds = typeof ttlSecondsRaw === "number" && ttlSecondsRaw > 0 ? ttlSecondsRaw : DEFAULT_TTL_SECONDS;
  const at = nowIso();

  try {
    const claim = await insertClaim(env.DB, {
      resourceId,
      resourceType,
      agentId: agent.id,
      ttlSeconds,
      at,
    });
    await insertEvent(env.DB, { type: "claim", resourceId, agentId: agent.id, at });
    return Response.json({ claim }, { status: 201 });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return Response.json({ error: "already_claimed" }, { status: 409 });
    }
    throw err;
  }
};

/** GET /claims — read-only, no auth required. */
export const queryClaims: Handler = async (request, env: Env) => {
  const url = new URL(request.url);
  const resourceType = url.searchParams.get("resource_type") ?? undefined;
  const resourceId = url.searchParams.get("resource_id") ?? undefined;
  const status = (url.searchParams.get("status") as ClaimStatus | null) ?? undefined;
  const claims = await listClaims(env.DB, { resourceType, resourceId, status });
  return Response.json({ claims });
};

export const heartbeatRoute: Handler = async (request, env: Env, params) => {
  const agent = await requireAgent(request, env);
  const id = parseClaimIdParam(params);
  const at = nowIso();
  const claim = await heartbeatClaim(env.DB, id, agent.id, at);
  if (!claim) {
    const existing = await getClaimById(env.DB, id);
    if (!existing) throw new HttpError(404, "claim_not_found");
    if (existing.agent_id !== agent.id) throw new HttpError(403, "not_claim_owner");
    throw new HttpError(409, `claim_not_active:${existing.status}`);
  }
  await insertEvent(env.DB, { type: "heartbeat", resourceId: claim.resource_id, agentId: agent.id, at });
  return Response.json({ claim });
};

export const releaseRoute: Handler = async (request, env: Env, params) => {
  const agent = await requireAgent(request, env);
  const id = parseClaimIdParam(params);
  const at = nowIso();
  const claim = await releaseClaim(env.DB, id, agent.id, at);
  if (!claim) {
    const existing = await getClaimById(env.DB, id);
    if (!existing) throw new HttpError(404, "claim_not_found");
    if (existing.agent_id !== agent.id) throw new HttpError(403, "not_claim_owner");
    throw new HttpError(409, `claim_not_active:${existing.status}`);
  }
  await insertEvent(env.DB, { type: "release", resourceId: claim.resource_id, agentId: agent.id, at });
  return Response.json({ claim });
};
