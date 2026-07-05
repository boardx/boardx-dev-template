import { sha256Hex } from "./lib/crypto";
import { HttpError } from "./lib/errors";
import { findAgentByTokenHash } from "./db/queries";
import type { AgentRow, Env } from "./db/types";

/** Identity is ALWAYS derived from the Bearer token, never from a request body
 *  field — a hard rule (see AGENTS.md), not a style preference: a request body
 *  can claim to be anyone, only the token proves who's actually calling. */
export async function requireAgent(request: Request, env: Env): Promise<AgentRow> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpError(401, "missing_bearer_token");
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) throw new HttpError(401, "missing_bearer_token");
  const tokenHash = await sha256Hex(token);
  const agent = await findAgentByTokenHash(env.DB, tokenHash);
  if (!agent) throw new HttpError(401, "invalid_or_inactive_token");
  return agent;
}

/** POST /verdicts is restricted to identities registered as `kind: reviewer`. */
export async function requireReviewer(request: Request, env: Env): Promise<AgentRow> {
  const agent = await requireAgent(request, env);
  if (agent.kind !== "reviewer") throw new HttpError(403, "reviewer_identity_required");
  return agent;
}
