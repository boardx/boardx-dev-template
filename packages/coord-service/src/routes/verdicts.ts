import { requireReviewer } from "../auth";
import { HttpError } from "../lib/errors";
import { nowIso } from "../lib/time";
import { insertEvent, insertVerdict } from "../db/queries";
import type { Env, VerdictResult } from "../db/types";
import type { Handler } from "../router";

function requireStringField(body: unknown, field: string): string {
  if (typeof body !== "object" || body === null) throw new HttpError(400, "invalid_body");
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `missing_field:${field}`);
  }
  return value;
}

/** POST /verdicts — restricted to `kind: reviewer` identities (see auth.ts). */
export const submitVerdict: Handler = async (request, env: Env) => {
  const agent = await requireReviewer(request, env);
  const body: unknown = await request.json().catch(() => {
    throw new HttpError(400, "invalid_json_body");
  });
  const prRef = requireStringField(body, "pr_ref");
  const reviewerKind = requireStringField(body, "reviewer_kind");
  const verdictValue = requireStringField(body, "verdict");
  if (verdictValue !== "ok" && verdictValue !== "changes") {
    throw new HttpError(400, "invalid_verdict_value");
  }
  const notesRaw = (body as Record<string, unknown>)["notes"];
  const notes = typeof notesRaw === "string" ? notesRaw : undefined;
  const at = nowIso();

  const verdict = await insertVerdict(env.DB, {
    prRef,
    reviewerKind,
    agentId: agent.id,
    verdict: verdictValue as VerdictResult,
    notes,
    at,
  });
  await insertEvent(env.DB, {
    type: "verdict",
    resourceId: prRef,
    agentId: agent.id,
    payload: { verdict: verdictValue, reviewerKind },
    at,
  });
  return Response.json({ verdict }, { status: 201 });
};
