import { createHash } from "node:crypto";

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
        ...questions.map((question) => ({ type: "question", ...question })),
        ...responses.map((response) => ({ type: "response", ...response })),
      ],
    },
  };
}
