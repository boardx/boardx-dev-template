import { Router } from "./router";
import { claimResource, heartbeatRoute, queryClaims, releaseRoute } from "./routes/claims";
import { submitVerdict } from "./routes/verdicts";
import { submitEvent } from "./routes/events";
import { publicStatus } from "./routes/status";
import { sweepStaleClaims } from "./cron/sweeper";
import { runProjector } from "./cron/projector";
import type { Env } from "./db/types";

const router = new Router();
// Human-friendly root: without this, someone opening the bare service URL in a
// browser gets {"error":"not_found"} and reasonably concludes the service is
// down (happened for real on 2026-07-08). Point them at the actual surface.
router.get("/", async () =>
  Response.json({
    service: "coord-service",
    description:
      "Agent coordination authority (claims/heartbeats/leases) — see ADR-009 and packages/coord-service/OPERATIONS.md",
    endpoints: {
      "GET /status": "public read-only snapshot: active claims + recent events",
      "GET /claims?resource_id=&status=": "query claims (Bearer token)",
      "POST /claims": "atomic claim (Bearer token)",
      "POST /claims/:id/heartbeat": "refresh lease (Bearer token)",
      "POST /claims/:id/release": "release lease (Bearer token)",
      "POST /verdicts": "record review verdict (Bearer token)",
      "POST /events": "record a narrative event: cycle-plan | cycle-result | andon (Bearer token)",
    },
  })
);
router.post("/claims", claimResource);
router.get("/claims", queryClaims);
router.post("/claims/:id/heartbeat", heartbeatRoute);
router.post("/claims/:id/release", releaseRoute);
router.post("/verdicts", submitVerdict);
router.post("/events", submitEvent);
router.get("/status", publicStatus);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },

  // Both the stale-claim sweep and the GitHub projector run off the same
  // schedule (see wrangler.toml) — both are cheap and idempotent, no reason to
  // split them into separate cron strings at this scale.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(sweepStaleClaims(env));
    ctx.waitUntil(runProjector(env));
  },
};
