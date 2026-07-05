import { getProjectorCursor, listEventsSince, setProjectorCursor } from "../db/queries";
import { addAgentLabel, isGithubConfigured, postIssueComment } from "./githubClient";
import type { EventRow, Env } from "../db/types";

const BATCH_LIMIT = 100;

/** Resolves a GitHub issue number from a resource_id, IF it follows the
 *  `issue:<number>` convention. Everything else (e.g. `role:coord-main`,
 *  `feature:p18/F03`) has no defined mapping yet — deciding how coordinator-role
 *  leases map onto issues is explicit Phase 4 territory in the implementation
 *  plan, not something to invent here. Unmapped events are skipped, not errored. */
function resolveIssueNumber(resourceId: string): number | null {
  const match = /^issue:(\d+)$/.exec(resourceId);
  if (!match) return null;
  const numberString = match[1];
  if (!numberString) return null;
  return Number(numberString);
}

function commentFor(event: EventRow): string {
  switch (event.type) {
    case "claim":
      return `claimed-by:${event.agent_id} at ${event.at}`;
    case "heartbeat":
      return `coordinator-heartbeat at ${event.at}`;
    case "release":
      return `released-by:${event.agent_id} at ${event.at}`;
    case "expire":
      return `expired (stale lease) at ${event.at}`;
    case "verdict":
      return `verdict by ${event.agent_id} at ${event.at}: ${event.payload ?? ""}`;
    case "merge":
      return `merged by ${event.agent_id} at ${event.at}`;
    default:
      return `event:${event.type} at ${event.at}`;
  }
}

/** One-way GitHub projector: reads events since a stored cursor and calls the
 *  GitHub API only on real transitions — no periodic heartbeat comments (that's
 *  the whole point of moving heartbeats into D1). No-ops entirely, without
 *  advancing the cursor, when GITHUB_TOKEN/GITHUB_REPO aren't configured — so
 *  Phase 1/local dev never attempts a real network call, and once Phase 2 wires
 *  real credentials, projection starts from whatever the cursor already is
 *  rather than retroactively replaying pre-configuration history. */
export async function runProjector(env: Env): Promise<{ processed: number; skipped: boolean }> {
  if (!isGithubConfigured(env)) {
    return { processed: 0, skipped: true };
  }
  const cursor = await getProjectorCursor(env.DB);
  const events = await listEventsSince(env.DB, cursor, BATCH_LIMIT);

  let processed = 0;
  for (const event of events) {
    const issueNumber = resolveIssueNumber(event.resource_id);
    if (issueNumber !== null) {
      await postIssueComment(env, issueNumber, commentFor(event));
      if (event.type === "claim") {
        await addAgentLabel(env, issueNumber, event.agent_id);
      }
    }
    await setProjectorCursor(env.DB, event.id);
    processed += 1;
  }
  return { processed, skipped: false };
}
