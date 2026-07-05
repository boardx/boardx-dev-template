import { listClaims, listRecentEvents } from "../db/queries";
import type { Env } from "../db/types";
import type { Handler } from "../router";

/** GET /status — public, unauthenticated, read-only snapshot. Full transparency
 *  (including for external/community readers) with zero write exposure — see the
 *  coordination-bus proposal's stance on community agents. */
export const publicStatus: Handler = async (_request, env: Env) => {
  const activeClaims = await listClaims(env.DB, { status: "in_progress" });
  const recentEvents = await listRecentEvents(env.DB, 50);
  return Response.json({
    active_claims: activeClaims,
    recent_events: recentEvents,
    generated_at: new Date().toISOString(),
  });
};
