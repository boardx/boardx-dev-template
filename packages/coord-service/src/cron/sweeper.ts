import { expireStaleClaims, insertEvent } from "../db/queries";
import { nowIso } from "../lib/time";
import type { Env } from "../db/types";

/** Sweeps claims whose heartbeat has gone stale past their ttl_seconds. Pure
 *  rule evaluation — this is exactly the kind of thing that belongs on a
 *  Cloudflare Cron Trigger, not waiting for some coordinator session's next
 *  poll cycle to notice (see the coordination-bus proposal, §"claim lifecycle"). */
export async function sweepStaleClaims(env: Env): Promise<{ expired: number }> {
  const at = nowIso();
  const expiredClaims = await expireStaleClaims(env.DB, at);
  for (const claim of expiredClaims) {
    await insertEvent(env.DB, {
      type: "expire",
      resourceId: claim.resource_id,
      agentId: claim.agent_id,
      at,
    });
  }
  return { expired: expiredClaims.length };
}
