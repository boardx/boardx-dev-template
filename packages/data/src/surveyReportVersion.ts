import { createHash } from "node:crypto";
import { query } from "./index";

export const SURVEY_REPORT_SOURCE_SCHEMA_VERSION = "survey-source-v1" as const;
export const SURVEY_REPORT_TEMPLATE_VERSION = "survey-report-v1" as const;

export interface SurveyReportSourceSnapshotInput {
  survey: {
    id: number;
    title: string;
    description: string;
    updatedAt: string;
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

export async function findReadySurveyReportArtifact(input: {
  surveyId: number;
  sourceRevision: string;
  requirementHash: string;
  templateVersion: string;
}): Promise<SurveyReportArtifactVersion | undefined> {
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

export async function listReadySurveyReportArtifacts(
  surveyId: number,
  limit = 20
): Promise<SurveyReportArtifactVersion[]> {
  const rows = await query<SurveyReportArtifactVersionRow>(
    `SELECT ${REPORT_ARTIFACT_COLUMNS}
     FROM survey_ai_report_artifacts
     WHERE survey_id = $1
       AND status = 'ready'
       AND source_revision IS NOT NULL
       AND requirement_hash IS NOT NULL
     ORDER BY created_at DESC
     LIMIT $2`,
    [surveyId, Math.max(1, Math.min(limit, 50))]
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
