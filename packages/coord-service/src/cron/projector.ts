import { getProjectorCursor, listEventsSince, setProjectorCursor } from "../db/queries";
import { addAgentLabel, findIssueByLabel, isGithubConfigured, postIssueComment } from "./githubClient";
import type { EventRow, Env } from "../db/types";

const BATCH_LIMIT = 100;

/** `role:coord-main` and `role:coord-<module>` are the two coordinator-role
 *  resource_id shapes lock.ts/module-lock.ts produce (see REMOTE_RESOURCE_ID
 *  in coordinator-lock.ts and the `role:${sessionId}` claim in module-lock.ts).
 *  Anything else (`feature:p18/F03`, a typo'd resource_id, a future shape not
 *  yet invented) is genuinely unmapped — skipped, not errored, same as before. */
type ResourceKind =
  | { kind: "issue"; issueNumber: number }
  | { kind: "coord-main"; label: string }
  | { kind: "module"; label: string }
  | { kind: "unmapped" };

function classifyResource(resourceId: string): ResourceKind {
  const issueMatch = /^issue:(\d+)$/.exec(resourceId);
  if (issueMatch) {
    const numberString = issueMatch[1];
    if (numberString) return { kind: "issue", issueNumber: Number(numberString) };
  }
  if (resourceId === "role:coord-main") {
    return { kind: "coord-main", label: "coordination:lease" };
  }
  const moduleMatch = /^role:coord-(.+)$/.exec(resourceId);
  if (moduleMatch) {
    const moduleName = moduleMatch[1];
    return { kind: "module", label: `coordination:lease:${moduleName}` };
  }
  return { kind: "unmapped" };
}

/** Resolves a GitHub issue number from a resource_id. `issue:<n>` decodes
 *  directly; `role:coord-main` / `role:coord-<module>` require a live
 *  label-search (there is no static mapping — lease issues are created
 *  on-demand per coordinator-sop.md/module-coordinator SKILL.md and can move).
 *  `labelCache` is per-run: a batch of events for the same role resolves to
 *  the same issue repeatedly, and searching once per batch instead of once
 *  per event avoids hammering the GitHub API on a busy heartbeat run. */
async function resolveIssueNumber(
  env: Env,
  resourceId: string,
  labelCache: Map<string, number | null>
): Promise<number | null> {
  const classified = classifyResource(resourceId);
  if (classified.kind === "issue") return classified.issueNumber;
  if (classified.kind === "unmapped") return null;

  const { label } = classified;
  if (labelCache.has(label)) return labelCache.get(label) ?? null;
  const issueNumber = await findIssueByLabel(env, label);
  labelCache.set(label, issueNumber);
  return issueNumber;
}

/** Module-coordinator events get the `module-coordinator-*` prefixed format
 *  already documented in .agents/skills/module-coordinator/SKILL.md and
 *  implemented by module-lock.ts's manual `gh issue comment` calls — the
 *  projector must match that convention exactly, not invent its own, since
 *  both paths write to the same lease issue and readers can't tell which
 *  one posted a given comment. coord-main and issue:<n> events keep the
 *  original unprefixed format, unchanged. */
function commentFor(event: EventRow, classified: ResourceKind): string {
  if (classified.kind === "module") {
    switch (event.type) {
      case "claim":
        return `module-coordinator-claim by:${event.agent_id} at ${event.at}`;
      case "heartbeat":
        return `module-coordinator-heartbeat by:${event.agent_id} at ${event.at}`;
      case "release":
        return `module-coordinator-release by:${event.agent_id} at ${event.at}`;
      case "expire":
        return `module-coordinator-release by:${event.agent_id} at ${event.at}（stale lease 自动过期）`;
      case "verdict":
        return `verdict by ${event.agent_id} at ${event.at}: ${event.payload ?? ""}`;
      case "merge":
        return `merged by ${event.agent_id} at ${event.at}`;
      default:
        return `event:${event.type} at ${event.at}`;
    }
  }
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
  const labelCache = new Map<string, number | null>();

  let processed = 0;
  for (const event of events) {
    const classified = classifyResource(event.resource_id);
    const issueNumber = await resolveIssueNumber(env, event.resource_id, labelCache);
    if (issueNumber !== null) {
      await postIssueComment(env, issueNumber, commentFor(event, classified));
      if (event.type === "claim") {
        await addAgentLabel(env, issueNumber, event.agent_id);
      }
    }
    await setProjectorCursor(env.DB, event.id);
    processed += 1;
  }
  return { processed, skipped: false };
}
