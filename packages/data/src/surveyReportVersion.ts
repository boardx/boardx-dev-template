import { createHash } from "node:crypto";
import { getPool, query } from "./index";

export const SURVEY_REPORT_SOURCE_SCHEMA_VERSION = "survey-source-v2" as const;
export const SURVEY_REPORT_TEMPLATE_VERSION =
  "template-driven-report-v1" as const;

export interface SurveyReportSourceSnapshotInput {
  survey: {
    id: number;
    title: string;
    description: string;
    updatedAt: string;
    responseMode?: "anonymous" | "identified";
    publishStartAt?: string | null;
    publishEndAt?: string | null;
    responseLimit?: number | null;
    oneResponsePerUser?: boolean;
  };
  questions: Array<{
    id: number;
    position: number;
    title: string;
    type: string;
    required: boolean;
    options: string[];
    category: string;
  }>;
  responses: Array<{
    id: number;
    submittedAt: string;
    answers: Record<string, unknown>;
  }>;
}

export interface SurveyReportSourceSnapshot {
  surveyId: number;
  sourceRevision: string;
  contentHash: string;
  schemaVersion: typeof SURVEY_REPORT_SOURCE_SCHEMA_VERSION;
  generatedAt: string;
  responseCount: number;
  sourceData: Record<string, unknown>;
}

export interface SurveyReportSourceSnapshotRecord extends SurveyReportSourceSnapshot {
  createdAt: string;
}

export interface SurveyReportArtifactVersion {
  id: string;
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
  responseCount: number;
  report: Record<string, unknown>;
  status: string;
  modelId: string;
  provider: string;
  createdAt: string;
}

export interface SurveyReportArtifactKey {
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
}

export type SurveyReportGenerationClaim =
  | {
      status: "claimed";
      sessionId: string;
    }
  | {
      status: "in_progress";
      sessionId: string;
    }
  | {
      status: "ready";
      artifact: SurveyReportArtifactVersion;
    };

interface SurveyReportSourceSnapshotRow {
  source_revision: string;
  survey_id: number;
  content_hash: string;
  schema_version: typeof SURVEY_REPORT_SOURCE_SCHEMA_VERSION;
  response_count: number;
  source_data: Record<string, unknown>;
  created_at: string;
}

interface SurveyReportArtifactVersionRow {
  id: string;
  survey_id: number;
  source_revision: string;
  requirement_hash: string;
  template_version: string;
  response_count: number;
  report: Record<string, unknown>;
  status: string;
  model_id: string;
  provider: string;
  created_at: string;
}

interface SurveyReportGenerationClaimRow {
  session_id: string;
  status: "generating" | "ready";
  updated_at: string;
}

function normalizeString(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function canonicalize(value: unknown): unknown {
  if (typeof value === "string") return normalizeString(value);
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function hashSurveyReportRequirement(input: unknown): string {
  return sha256(input);
}

export function buildSurveyReportSourceSnapshot(
  input: SurveyReportSourceSnapshotInput,
  generatedAt = new Date().toISOString()
): SurveyReportSourceSnapshot {
  const questions = input.questions
    .map((question) => ({
      id: question.id,
      position: question.position,
      title: question.title,
      type: question.type,
      required: question.required,
      options: question.options,
      category: question.category,
    }))
    .sort((left, right) => left.position - right.position || left.id - right.id);
  const responses = input.responses
    .map((response) => ({
      id: response.id,
      submittedAt: response.submittedAt,
      answers: response.answers,
    }))
    .sort((left, right) =>
      left.submittedAt.localeCompare(right.submittedAt) || left.id - right.id
    );
  const content = {
    schemaVersion: SURVEY_REPORT_SOURCE_SCHEMA_VERSION,
    survey: {
      id: input.survey.id,
      title: input.survey.title,
      description: input.survey.description,
      responseMode: input.survey.responseMode ?? "anonymous",
      publishStartAt: input.survey.publishStartAt ?? null,
      publishEndAt: input.survey.publishEndAt ?? null,
      responseLimit: input.survey.responseLimit ?? null,
      oneResponsePerUser: input.survey.oneResponsePerUser ?? false,
    },
    questions,
    responses,
  };
  const contentHash = sha256(content);
  const sourceRevision = `survey-${input.survey.id}-${contentHash}`;

  return {
    surveyId: input.survey.id,
    sourceRevision,
    contentHash,
    schemaVersion: SURVEY_REPORT_SOURCE_SCHEMA_VERSION,
    generatedAt,
    responseCount: responses.length,
    sourceData: {
      format: "survey-source.jsonl",
      records: [
        {
          type: "manifest",
          schemaVersion: SURVEY_REPORT_SOURCE_SCHEMA_VERSION,
          sourceRevision,
          contentHash,
          responseCount: responses.length,
        },
        { type: "survey", ...content.survey },
        ...questions.map(({ type: questionType, ...question }) => ({
          type: "question",
          questionType,
          ...question,
        })),
        ...responses.map((response) => ({ type: "response", ...response })),
      ],
    },
  };
}

function sourceSnapshotFromRow(row: SurveyReportSourceSnapshotRow): SurveyReportSourceSnapshotRecord {
  return {
    surveyId: Number(row.survey_id),
    sourceRevision: row.source_revision,
    contentHash: row.content_hash,
    schemaVersion: row.schema_version,
    generatedAt: row.created_at,
    responseCount: Number(row.response_count),
    sourceData: row.source_data,
    createdAt: row.created_at,
  };
}

function artifactFromRow(row: SurveyReportArtifactVersionRow): SurveyReportArtifactVersion {
  return {
    id: row.id,
    surveyId: Number(row.survey_id),
    sourceRevision: row.source_revision,
    requirementHash: row.requirement_hash,
    templateVersion: row.template_version,
    responseCount: Number(row.response_count),
    report: row.report,
    status: row.status,
    modelId: row.model_id,
    provider: row.provider,
    createdAt: row.created_at,
  };
}

const SOURCE_SNAPSHOT_COLUMNS =
  "source_revision, survey_id, content_hash, schema_version, response_count, source_data, created_at";
const REPORT_ARTIFACT_COLUMNS =
  "id, survey_id, source_revision, requirement_hash, template_version, response_count, report, status, model_id, provider, created_at";
const REPORT_ARTIFACT_SUMMARY_COLUMNS =
  "id, survey_id, source_revision, requirement_hash, template_version, response_count, '{}'::jsonb AS report, status, model_id, provider, created_at";

export async function ensureSurveyReportSourceSnapshot(
  snapshot: SurveyReportSourceSnapshot
): Promise<SurveyReportSourceSnapshotRecord> {
  const rows = await query<SurveyReportSourceSnapshotRow>(
    `INSERT INTO survey_report_source_snapshots
      (source_revision, survey_id, content_hash, schema_version, response_count, source_data, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (survey_id, content_hash) DO UPDATE
       SET source_revision = EXCLUDED.source_revision
     RETURNING ${SOURCE_SNAPSHOT_COLUMNS}`,
    [
      snapshot.sourceRevision,
      snapshot.surveyId,
      snapshot.contentHash,
      snapshot.schemaVersion,
      snapshot.responseCount,
      JSON.stringify(snapshot.sourceData),
      snapshot.generatedAt,
    ]
  );
  return sourceSnapshotFromRow(rows[0]!);
}

export async function findSurveyReportSourceSnapshot(
  sourceRevision: string
): Promise<SurveyReportSourceSnapshotRecord | undefined> {
  const rows = await query<SurveyReportSourceSnapshotRow>(
    `SELECT ${SOURCE_SNAPSHOT_COLUMNS}
     FROM survey_report_source_snapshots
     WHERE source_revision = $1
     LIMIT 1`,
    [sourceRevision]
  );
  return rows[0] ? sourceSnapshotFromRow(rows[0]) : undefined;
}

export async function findReadySurveyReportArtifact(
  input: SurveyReportArtifactKey
): Promise<SurveyReportArtifactVersion | undefined> {
  const rows = await query<SurveyReportArtifactVersionRow>(
    `SELECT ${REPORT_ARTIFACT_COLUMNS}
     FROM survey_ai_report_artifacts
     WHERE survey_id = $1
       AND source_revision = $2
       AND requirement_hash = $3
       AND template_version = $4
       AND status = 'ready'
     ORDER BY created_at DESC
     LIMIT 1`,
    [input.surveyId, input.sourceRevision, input.requirementHash, input.templateVersion]
  );
  return rows[0] ? artifactFromRow(rows[0]) : undefined;
}

export async function findReadySurveyReportArtifactById(
  surveyId: number,
  artifactId: string
): Promise<SurveyReportArtifactVersion | undefined> {
  const rows = await query<SurveyReportArtifactVersionRow>(
    `SELECT ${REPORT_ARTIFACT_COLUMNS}
     FROM survey_ai_report_artifacts
     WHERE survey_id = $1
       AND id = $2
       AND status = 'ready'
       AND source_revision IS NOT NULL
       AND requirement_hash IS NOT NULL
     LIMIT 1`,
    [surveyId, artifactId]
  );
  return rows[0] ? artifactFromRow(rows[0]) : undefined;
}

const GENERATION_CLAIM_TTL_MS = 15 * 60 * 1000;

export async function claimSurveyReportGeneration(
  input: SurveyReportArtifactKey & {
    sessionId: string;
    actorUserId: number;
    goal: string;
    teamId: number | null;
    selectedModelId: string;
    provider: string;
    context: Record<string, unknown>;
  }
): Promise<SurveyReportGenerationClaim> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [
        `survey-report:${input.surveyId}:${input.sourceRevision}`,
        `${input.requirementHash}:${input.templateVersion}`,
      ]
    );

    const ready = await client.query<SurveyReportArtifactVersionRow>(
      `SELECT ${REPORT_ARTIFACT_COLUMNS}
       FROM survey_ai_report_artifacts
       WHERE survey_id = $1
         AND source_revision = $2
         AND requirement_hash = $3
         AND template_version = $4
         AND status = 'ready'
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        input.surveyId,
        input.sourceRevision,
        input.requirementHash,
        input.templateVersion,
      ]
    );
    if (ready.rows[0]) {
      await client.query("COMMIT");
      return {
        status: "ready",
        artifact: artifactFromRow(ready.rows[0]),
      };
    }

    const claim = await client.query<SurveyReportGenerationClaimRow>(
      `SELECT session_id, status, updated_at
       FROM survey_report_generation_claims
       WHERE survey_id = $1
         AND source_revision = $2
         AND requirement_hash = $3
         AND template_version = $4`,
      [
        input.surveyId,
        input.sourceRevision,
        input.requirementHash,
        input.templateVersion,
      ]
    );
    const existing = claim.rows[0];
    const staleBefore = Date.now() - GENERATION_CLAIM_TTL_MS;
    if (
      existing?.status === "generating" &&
      new Date(existing.updated_at).getTime() >= staleBefore
    ) {
      await client.query("COMMIT");
      return {
        status: "in_progress",
        sessionId: existing.session_id,
      };
    }

    if (existing?.status === "generating") {
      await client.query(
        `UPDATE survey_ai_sessions
         SET status = 'failed',
             error_message = 'generation_claim_expired',
             updated_at = now()
         WHERE id = $1 AND status = 'generating'`,
        [existing.session_id]
      );
    }

    await client.query(
      `INSERT INTO survey_ai_sessions
        (id, actor_user_id, kind, goal, survey_id, team_id, status,
         selected_model_id, provider, context)
       VALUES ($1, $2, 'report', $3, $4, $5, 'generating', $6, $7, $8::jsonb)`,
      [
        input.sessionId,
        input.actorUserId,
        input.goal,
        input.surveyId,
        input.teamId,
        input.selectedModelId,
        input.provider,
        JSON.stringify(input.context),
      ]
    );
    await client.query(
      `INSERT INTO survey_report_generation_claims
        (survey_id, source_revision, requirement_hash, template_version,
         session_id, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'generating', now())
       ON CONFLICT (survey_id, source_revision, requirement_hash, template_version)
       DO UPDATE SET
         session_id = EXCLUDED.session_id,
         artifact_id = NULL,
         status = 'generating',
         updated_at = now()`,
      [
        input.surveyId,
        input.sourceRevision,
        input.requirementHash,
        input.templateVersion,
        input.sessionId,
      ]
    );
    await client.query("COMMIT");
    return { status: "claimed", sessionId: input.sessionId };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeSurveyReportGenerationClaim(
  input: SurveyReportArtifactKey & {
    sessionId: string;
    artifactId: string;
  }
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE survey_ai_sessions
       SET status = 'ready', error_message = NULL, updated_at = now()
       WHERE id = $1`,
      [input.sessionId]
    );
    const completed = await client.query<{ session_id: string }>(
      `UPDATE survey_report_generation_claims
       SET status = 'ready', artifact_id = $6, updated_at = now()
       WHERE survey_id = $1
         AND source_revision = $2
         AND requirement_hash = $3
         AND template_version = $4
         AND session_id = $5
       RETURNING session_id`,
      [
        input.surveyId,
        input.sourceRevision,
        input.requirementHash,
        input.templateVersion,
        input.sessionId,
        input.artifactId,
      ]
    );
    if (!completed.rows[0]) {
      throw new Error("报告生成 claim 完成失败");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseSurveyReportGenerationClaim(
  input: SurveyReportArtifactKey & {
    sessionId: string;
    errorMessage: string;
  }
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const artifact = await client.query<{ id: string }>(
      `SELECT id
       FROM survey_ai_report_artifacts
       WHERE session_id = $1
         AND survey_id = $2
         AND source_revision = $3
         AND requirement_hash = $4
         AND template_version = $5
         AND status = 'ready'
       LIMIT 1`,
      [
        input.sessionId,
        input.surveyId,
        input.sourceRevision,
        input.requirementHash,
        input.templateVersion,
      ]
    );
    if (artifact.rows[0]) {
      await client.query(
        `UPDATE survey_ai_sessions
         SET status = 'ready', error_message = NULL, updated_at = now()
         WHERE id = $1`,
        [input.sessionId]
      );
      await client.query(
        `UPDATE survey_report_generation_claims
         SET status = 'ready', artifact_id = $6, updated_at = now()
         WHERE survey_id = $1
           AND source_revision = $2
           AND requirement_hash = $3
           AND template_version = $4
           AND session_id = $5`,
        [
          input.surveyId,
          input.sourceRevision,
          input.requirementHash,
          input.templateVersion,
          input.sessionId,
          artifact.rows[0].id,
        ]
      );
    } else {
      await client.query(
        `UPDATE survey_ai_sessions
         SET status = 'failed', error_message = $2, updated_at = now()
         WHERE id = $1`,
        [input.sessionId, input.errorMessage]
      );
      await client.query(
        `DELETE FROM survey_report_generation_claims
         WHERE survey_id = $1
           AND source_revision = $2
           AND requirement_hash = $3
           AND template_version = $4
           AND session_id = $5
           AND status = 'generating'`,
        [
          input.surveyId,
          input.sourceRevision,
          input.requirementHash,
          input.templateVersion,
          input.sessionId,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listReadySurveyReportArtifacts(
  surveyId: number,
  options: {
    limit?: number;
    before?: { createdAt: string; id: string };
  } = {}
): Promise<SurveyReportArtifactVersion[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const rows = await query<SurveyReportArtifactVersionRow>(
    `SELECT ${REPORT_ARTIFACT_SUMMARY_COLUMNS}
     FROM survey_ai_report_artifacts
     WHERE survey_id = $1
       AND status = 'ready'
       AND source_revision IS NOT NULL
       AND requirement_hash IS NOT NULL
       AND (
         $2::timestamptz IS NULL
         OR (created_at, id) < ($2::timestamptz, $3::uuid)
       )
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [
      surveyId,
      options.before?.createdAt ?? null,
      options.before?.id ?? null,
      limit,
    ]
  );
  return rows.map(artifactFromRow);
}

export async function createVersionedSurveyReportArtifact(input: {
  id: string;
  sessionId: string;
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
  responseCount: number;
  report: Record<string, unknown>;
  modelId: string;
  provider: string;
}): Promise<SurveyReportArtifactVersion> {
  const rows = await query<SurveyReportArtifactVersionRow>(
    `INSERT INTO survey_ai_report_artifacts
      (id, session_id, survey_id, response_count, filter_context, report, status, model_id, provider,
       source_revision, requirement_hash, template_version)
     VALUES ($1, $2, $3, $4, '{}'::jsonb, $5::jsonb, 'ready', $6, $7, $8, $9, $10)
     ON CONFLICT DO NOTHING
     RETURNING ${REPORT_ARTIFACT_COLUMNS}`,
    [
      input.id,
      input.sessionId,
      input.surveyId,
      input.responseCount,
      JSON.stringify(input.report),
      input.modelId,
      input.provider,
      input.sourceRevision,
      input.requirementHash,
      input.templateVersion,
    ]
  );
  if (rows[0]) return artifactFromRow(rows[0]);
  const existing = await findReadySurveyReportArtifact(input);
  if (!existing) throw new Error("报告产物写入失败");
  return existing;
}
