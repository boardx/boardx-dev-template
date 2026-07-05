import { Router } from "./router";
import { claimResource, heartbeatRoute, queryClaims, releaseRoute } from "./routes/claims";
import { submitVerdict } from "./routes/verdicts";
import { publicStatus } from "./routes/status";
import { sweepStaleClaims } from "./cron/sweeper";
import { runProjector } from "./cron/projector";
import type { Env } from "./db/types";

const router = new Router();
router.post("/claims", claimResource);
router.get("/claims", queryClaims);
router.post("/claims/:id/heartbeat", heartbeatRoute);
router.post("/claims/:id/release", releaseRoute);
router.post("/verdicts", submitVerdict);
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
