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

// coord-main / module-coordinator / architecture-coordinator——即 registry.yaml 里
// 所有 coordinator 层身份。andon 停线信号是协调层专属权力（见 coordinator-sop.md），
// 不能让普通 worker 伪造一个 stop 拉停整个 fleet、或伪造 clear 在 main 仍红时解除停线。
export const COORDINATOR_KINDS: ReadonlySet<string> = new Set([
  "coordinator",
  "module-coordinator",
  "architecture-coordinator",
]);
