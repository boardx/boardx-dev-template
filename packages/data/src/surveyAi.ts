import { query } from "./index";

export type JsonObject = Record<string, unknown>;

export function normalizeJsonObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export interface SurveyAiSessionInput {
  id: string;
  actorUserId: number;
  kind: string;
  goal: string;
  surveyId: number | null;
  teamId: number | null;
  status: string;
  selectedModelId: string;
  provider: string;
  context: JsonObject;
}

export async function createSurveyAiSession(input: SurveyAiSessionInput): Promise<{ id: string }> {
  const rows = await query<{ id: string }>(
    `INSERT INTO survey_ai_sessions
      (id, actor_user_id, kind, goal, survey_id, team_id, status, selected_model_id, provider, context)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id`,
    [input.id, input.actorUserId, input.kind, input.goal, input.surveyId, input.teamId, input.status,
      input.selectedModelId, input.provider, JSON.stringify(input.context)]
  );
  return rows[0]!;
}

export async function updateSurveyAiSessionStatus(id: string, status: string, errorMessage?: string): Promise<void> {
  await query(
    "UPDATE survey_ai_sessions SET status=$2, error_message=$3, updated_at=now() WHERE id=$1",
    [id, status, errorMessage ?? null]
  );
}

export async function createSurveyAiModelTrace(input: {
  id: string; sessionId: string; provider: string; modelId: string; prompt: JsonObject;
  response?: JsonObject; status: string; errorMessage?: string; latencyMs: number;
}): Promise<void> {
  await query(
    `INSERT INTO survey_ai_model_traces
      (id,session_id,provider,model_id,prompt,response,status,error_message,latency_ms)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
    [input.id, input.sessionId, input.provider, input.modelId, JSON.stringify(input.prompt),
      input.response ? JSON.stringify(input.response) : null, input.status, input.errorMessage ?? null, input.latencyMs]
  );
}

export async function createSurveyAiReportArtifact(input: {
  id: string; sessionId: string; surveyId: number; responseCount: number; filterContext: JsonObject;
  report: JsonObject; status: string; modelId: string; provider: string;
}): Promise<void> {
  await query(
    `INSERT INTO survey_ai_report_artifacts
      (id,session_id,survey_id,response_count,filter_context,report,status,model_id,provider)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
    [input.id, input.sessionId, input.surveyId, input.responseCount, JSON.stringify(input.filterContext),
      JSON.stringify(input.report), input.status, input.modelId, input.provider]
  );
}

export async function saveSurveyAiDraftSession(input: {
  id: string; actorUserId: number; modelId: string; draft: JsonObject; goal: string;
}): Promise<void> {
  await query(
    `INSERT INTO survey_ai_sessions
      (id,actor_user_id,kind,goal,status,selected_model_id,provider,context)
     VALUES ($1,$2,'create_survey',$3,'open',$4,$5,$6::jsonb)
     ON CONFLICT (id) DO UPDATE SET goal=EXCLUDED.goal, status='open', selected_model_id=EXCLUDED.selected_model_id,
       provider=EXCLUDED.provider, context=EXCLUDED.context, error_message=NULL, updated_at=now()`,
    [input.id, input.actorUserId, input.goal, input.modelId, input.modelId.startsWith("mock-") ? "mock" : "qwen",
      JSON.stringify({ draft: input.draft })]
  );
}

export async function listSurveyAiSessions(userId: number, kind: string, status: string, limit: number) {
  return query<{ id: string; status: string; kind: string; updated_at: string }>(
    `SELECT id,status,kind,updated_at FROM survey_ai_sessions
     WHERE actor_user_id=$1 AND kind=$2 AND status=$3 ORDER BY updated_at DESC LIMIT $4`,
    [userId, kind, status, Math.max(1, Math.min(limit, 20))]
  );
}

export async function getSurveyAiSessionBundle(id: string, userId: number) {
  const rows = await query<{ id: string; status: string; context: JsonObject }>(
    "SELECT id,status,context FROM survey_ai_sessions WHERE id=$1 AND actor_user_id=$2",
    [id, userId]
  );
  const session = rows[0];
  if (!session) return undefined;
  return { session, drafts: session.context?.draft ? [{ draft: session.context.draft }] : [] };
}

export async function updateSurveyAiSessionForUser(id: string, userId: number, status: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE survey_ai_sessions SET status=$3, updated_at=now() WHERE id=$1 AND actor_user_id=$2 RETURNING id",
    [id, userId, status]
  );
  return rows.length > 0;
}
