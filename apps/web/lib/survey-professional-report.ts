import {
  SURVEY_MIN_RELIABLE_SAMPLE,
  type SurveyEvidenceClaim,
  type SurveyQuestionEvidence,
  type SurveyReportEvidenceBundle,
} from "./survey-report-evidence";
import type {
  SurveyReportCategoryInput,
  SurveyReportCategoryPlanInput,
  SurveyReportChartTemplateId,
  SurveyReportOutputType,
} from "@repo/data";
import { buildSurveyReportChartOption } from "./survey-report-chart-templates";

export interface AiEvidenceClaimCandidate {
  statement: string;
  evidenceId: string;
  value: number;
  denominator: number;
  implication?: string;
  recommendation?: string;
}

export interface ValidatedReportClaim extends SurveyEvidenceClaim {
  implication?: string;
  recommendation?: string;
}

export interface ProfessionalReportChart {
  questionId: number;
  title: string;
  type: "bar" | "score";
  templateId?: SurveyReportChartTemplateId;
  option?: Record<string, unknown>;
  denominator: number;
  denominatorLabel: string;
  rows: Array<{ label: string; count: number; percentage: number }>;
}

export interface ProfessionalReportChapter {
  id: string;
  categoryId?: string;
  title: string;
  questionId: number;
  questionIds?: number[];
  requirement?: string;
  outputType?: SurveyReportOutputType;
  chartTemplateId?: SurveyReportChartTemplateId;
  imagePrompt?: string;
  validResponseCount: number;
  missingResponseCount: number;
  chart?: ProfessionalReportChart;
  claims: ValidatedReportClaim[];
  limitations: string[];
}

export interface ProfessionalSurveyReportDocument {
  title: string;
  generatedAt: string;
  status: "empty" | "directional" | "ready";
  emptyState?: string;
  executiveSummary: { claims: ValidatedReportClaim[] };
  methodology: {
    sampleSize: number;
    questionCount: number;
    confidence: SurveyReportEvidenceBundle["sample"]["confidence"];
    statement: string;
  };
  chapters: ProfessionalReportChapter[];
  limitations: string[];
  actions: Array<{ priority: "high" | "medium"; action: string; evidenceIds: string[] }>;
}

export function validateEvidenceClaims(
  evidence: SurveyReportEvidenceBundle,
  candidates: AiEvidenceClaimCandidate[]
): ValidatedReportClaim[] {
  const source = new Map(evidence.claims.map((claim) => [claim.id, claim]));
  const rawTextResponses = evidence.questions.flatMap(
    (question) => question.textResponses ?? []
  );
  return candidates.flatMap((candidate) => {
    const matched = source.get(candidate.evidenceId);
    if (!matched || matched.value !== candidate.value || matched.denominator !== candidate.denominator) return [];
    const generatedText = [
      candidate.statement,
      candidate.implication,
      candidate.recommendation,
    ].filter(Boolean).join("\n");
    if (rawTextResponses.some((response) =>
      response.length > 1 && generatedText.includes(response)
    )) {
      return [];
    }
    return [{
      ...matched,
      statement: candidate.statement.trim() || matched.statement,
      implication: candidate.implication?.trim() || undefined,
      recommendation: candidate.recommendation?.trim() || undefined,
    }];
  });
}

export function modelSafeSurveyReportEvidence(
  evidence: SurveyReportEvidenceBundle
): SurveyReportEvidenceBundle {
  return {
    ...evidence,
    questions: evidence.questions.map((question) => {
      const { textResponses: _rawTextResponses, ...safeQuestion } = question;
      return safeQuestion;
    }),
  };
}

export function rawTextResponsesFromSourceData(
  sourceData: Record<string, unknown> | undefined
): string[] {
  const records = Array.isArray(sourceData?.records) ? sourceData.records : [];
  const textQuestionIds = new Set(
    records.flatMap((record) => {
      if (!record || typeof record !== "object") return [];
      const item = record as Record<string, unknown>;
      return item.type === "question" &&
        ["short_text", "text"].includes(String(item.questionType))
        ? [String(item.id)]
        : [];
    })
  );
  return Array.from(new Set(records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const item = record as Record<string, unknown>;
    if (item.type !== "response" || !item.answers || typeof item.answers !== "object") {
      return [];
    }
    return Object.entries(item.answers as Record<string, unknown>)
      .filter(([questionId]) => textQuestionIds.has(questionId))
      .flatMap(([, answer]) => Array.isArray(answer) ? answer : [answer])
      .map((answer) => String(answer ?? "").trim())
      .filter(Boolean);
  })));
}

function redactRawText(value: unknown, rawTextResponses: string[]): unknown {
  if (typeof value === "string") {
    return rawTextResponses.reduce(
      (redacted, response) =>
        response.length > 1
          ? redacted.split(response).join("[开放题原文已脱敏]")
          : redacted,
      value
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactRawText(item, rawTextResponses));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      redactRawText(item, rawTextResponses),
    ])
  );
}

function chartForQuestion(question: SurveyQuestionEvidence): ProfessionalReportChart | undefined {
  const rows = question.distribution ?? question.score?.distribution;
  if (!rows?.length || question.validResponseCount === 0) return undefined;
  return {
    questionId: question.questionId,
    title: question.title,
    type: question.score ? "score" : "bar",
    denominator: question.validResponseCount,
    denominatorLabel: question.type === "multiple" ? "有效答题人数" : "有效回答数",
    rows: rows.map((row) => ({ label: row.label, count: row.count, percentage: row.percentage })),
  };
}

function chapterForQuestion(
  question: SurveyQuestionEvidence,
  claims: ValidatedReportClaim[],
  lowSample: boolean
): ProfessionalReportChapter {
  const limitations: string[] = [];
  if (!question.validResponseCount) limitations.push("该题暂无有效回答。");
  else if (lowSample) {
    limitations.push(`该题样本不足 ${SURVEY_MIN_RELIABLE_SAMPLE}，结果仅作为方向性信号。`);
  }
  if (question.missingResponseCount > 0) limitations.push(`该题有 ${question.missingResponseCount} 份缺失回答。`);
  return {
    id: `question-${question.questionId}`,
    title: question.title,
    questionId: question.questionId,
    questionIds: [question.questionId],
    outputType: chartForQuestion(question) ? "chart" : "text",
    validResponseCount: question.validResponseCount,
    missingResponseCount: question.missingResponseCount,
    chart: chartForQuestion(question),
    claims: claims.filter((claim) => claim.questionId === question.questionId),
    limitations,
  };
}

function categoryQuestions(
  category: SurveyReportCategoryInput,
  evidence: SurveyReportEvidenceBundle
): SurveyQuestionEvidence[] {
  if (!category.questionIds.length) return evidence.questions;
  const selected = new Set(category.questionIds);
  return evidence.questions.filter((question) => selected.has(question.questionId));
}

function chapterForCategory(
  category: SurveyReportCategoryInput,
  evidence: SurveyReportEvidenceBundle,
  claims: ValidatedReportClaim[],
  lowSample: boolean
): ProfessionalReportChapter {
  const questions = categoryQuestions(category, evidence);
  const questionIds = questions.map((question) => question.questionId);
  const selectedClaims = claims.filter((claim) => questionIds.includes(claim.questionId));
  const chartQuestion = questions.find((question) => chartForQuestion(question));
  const chart = category.outputType === "chart" && chartQuestion
    ? {
        ...chartForQuestion(chartQuestion)!,
        templateId: category.chartTemplateId,
        option: buildSurveyReportChartOption(
          category.chartTemplateId ?? "line-simple",
          chartForQuestion(chartQuestion)!.rows
        ),
      }
    : undefined;
  const limitations = Array.from(new Set([
    ...(lowSample
      ? [`章节样本不足 ${SURVEY_MIN_RELIABLE_SAMPLE}，结果仅作为方向性信号。`]
      : []),
    ...(questions.length
      ? []
      : ["当前章节尚未匹配到可分析的问题。"]),
    ...(category.outputType === "chart" && !chart
      ? ["当前章节没有可聚合为图表的结构化回答。"]
      : []),
  ]));

  return {
    id: `category-${category.id}`,
    categoryId: category.id,
    title: category.name,
    questionId: questions[0]?.questionId ?? 0,
    questionIds,
    requirement: category.requirement?.trim() || category.prompt.trim(),
    outputType: category.outputType,
    chartTemplateId:
      category.outputType === "chart" ? category.chartTemplateId : undefined,
    imagePrompt:
      category.outputType === "image"
        ? category.requirement?.trim() || category.prompt.trim()
        : undefined,
    validResponseCount: evidence.sample.responseCount,
    missingResponseCount: Math.max(
      0,
      ...questions.map((question) => question.missingResponseCount)
    ),
    chart,
    claims: selectedClaims,
    limitations,
  };
}

export function sanitizeProfessionalReportDocument(
  report: ProfessionalSurveyReportDocument,
  rawTextResponses: string[] = []
): ProfessionalSurveyReportDocument {
  const redactedReport = redactRawText(
    report,
    rawTextResponses
  ) as ProfessionalSurveyReportDocument;
  return {
    ...redactedReport,
    chapters: (
      Array.isArray(redactedReport.chapters) ? redactedReport.chapters : []
    ).map((rawChapter) => {
      const {
        textResponses: _rawTextResponses,
        ...chapter
      } = rawChapter as ProfessionalReportChapter & {
        textResponses?: unknown;
      };
      const outputType = ["image", "chart", "text"].includes(
        String(chapter.outputType)
      )
        ? chapter.outputType
        : chapter.chart
          ? "chart"
          : "text";
      return {
        ...chapter,
        outputType,
        questionIds: Array.isArray(chapter.questionIds)
          ? chapter.questionIds
          : [chapter.questionId].filter((id) => id > 0),
      };
    }),
  };
}

export function buildProfessionalReportDocument({
  evidence,
  generatedAt,
  aiClaims = [],
  reportPlan,
}: {
  evidence: SurveyReportEvidenceBundle;
  generatedAt: string;
  aiClaims?: AiEvidenceClaimCandidate[];
  reportPlan?: SurveyReportCategoryPlanInput;
}): ProfessionalSurveyReportDocument {
  const validatedAiClaims = validateEvidenceClaims(evidence, aiClaims);
  const claims: ValidatedReportClaim[] = validatedAiClaims.length ? validatedAiClaims : evidence.claims;
  const lowSample = evidence.sample.responseCount > 0
    && evidence.sample.responseCount < SURVEY_MIN_RELIABLE_SAMPLE;
  const status = evidence.sample.responseCount === 0 ? "empty" : lowSample ? "directional" : "ready";
  return {
    title: `${evidence.survey.title} 分析报告`,
    generatedAt,
    status,
    emptyState: status === "empty" ? "尚无真实答卷，无法生成分析结论。" : undefined,
    executiveSummary: { claims: status === "empty" ? [] : claims.slice(0, 5) },
    methodology: {
      sampleSize: evidence.sample.responseCount,
      questionCount: evidence.survey.questionCount,
      confidence: evidence.sample.confidence,
      statement: "报告仅使用已提交的真实答卷；每张图表按单个题目独立聚合。",
    },
    chapters: reportPlan?.categories.length
      ? reportPlan.categories
          .slice()
          .sort((left, right) => left.order - right.order)
          .map((category) =>
            chapterForCategory(category, evidence, claims, lowSample)
          )
      : evidence.questions.map((question) =>
          chapterForQuestion(question, claims, lowSample)
        ),
    limitations: evidence.limitations,
    actions: status === "empty"
      ? []
      : claims.slice(0, 3).map((claim) => ({
          priority: claim.directional ? "medium" : "high",
          action: claim.recommendation ?? `进一步验证「${claim.evidenceLabel}」背后的原因。`,
          evidenceIds: [claim.id],
        })),
  };
}
