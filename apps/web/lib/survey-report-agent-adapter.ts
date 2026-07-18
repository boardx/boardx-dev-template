import {
  defaultGateway,
  runSurveyReportAgent,
  type SurveyReportChapterDraft,
  type SurveyReportAgentTools,
  type SurveyReportSourceSnapshotLike,
} from "@repo/ai";
export type { SurveyReportSourceSnapshotLike } from "@repo/ai";
import type { SurveyReportCategoryInput } from "@repo/data";
import type { AiEvidenceClaimCandidate } from "./survey-professional-report";
import type { SurveyReportEvidenceBundle } from "./survey-report-evidence";

export interface SurveyReportChapterGeneratorInput {
  modelId: string;
  chapter: {
    id: string;
    categoryKey: string;
    title: string;
    goal: string;
    requirement: string;
  };
  tools: SurveyReportAgentTools;
  evidence: SurveyReportEvidenceBundle;
}

export type SurveyReportChapterGenerator = (
  input: SurveyReportChapterGeneratorInput
) => Promise<SurveyReportChapterDraft>;

export interface GenerateSurveyReportAgentClaimsInput {
  snapshot: SurveyReportSourceSnapshotLike;
  categories: SurveyReportCategoryInput[];
  evidence: SurveyReportEvidenceBundle;
  modelId: string;
  maxModelCalls?: number;
  generateChapter?: SurveyReportChapterGenerator;
}

export interface SurveyReportAgentClaimsResult {
  status: "ready" | "partial" | "failed";
  stopReason?: string;
  claims: AiEvidenceClaimCandidate[];
  chapterTitles: string[];
  audit: {
    sourceReads: string[];
    modelCalls: number;
  };
}

function categoryRequirement(category: SurveyReportCategoryInput): string {
  const requirement = String(
    (category as SurveyReportCategoryInput & { requirement?: unknown })
      .requirement ?? ""
  ).trim();
  return requirement || category.prompt.trim();
}

function parseJsonObject(value: string): Record<string, unknown> {
  const trimmed = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("survey_report_agent_invalid_json");
  }
  const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("survey_report_agent_invalid_json");
  }
  return parsed as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : [];
}

function evidenceRefs(value: unknown): SurveyReportChapterDraft["evidenceRefs"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const evidenceId = String(record.evidenceId ?? "").trim();
    const numericValue = Number(record.value);
    const denominator = Number(record.denominator);
    if (
      !evidenceId ||
      !Number.isFinite(numericValue) ||
      !Number.isFinite(denominator)
    ) {
      return [];
    }
    return [{ evidenceId, value: numericValue, denominator }];
  });
}

function retrieveChapterRecords(
  chapter: SurveyReportChapterGeneratorInput["chapter"],
  tools: SurveyReportAgentTools
): string[] {
  const categoryMatches = tools.grep(
    `"category":"${chapter.categoryKey}"`,
    "/source/"
  );
  const questionIds = categoryMatches.flatMap(({ text }) => {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return typeof parsed.id === "number" ? [parsed.id] : [];
  });
  const matches = questionIds.flatMap((questionId) =>
    tools.grep(`"${questionId}"`, "/source/")
  );
  const fallback = matches.length
    ? []
    : tools.grep(chapter.categoryKey, "/source/");
  return [
    ...new Set(
      [...categoryMatches, ...matches, ...fallback].map(({ text }) => text)
    ),
  ];
}

async function generateChapterWithGateway({
  modelId,
  chapter,
  tools,
  evidence,
}: SurveyReportChapterGeneratorInput): Promise<SurveyReportChapterDraft> {
  const retrievedRecords = retrieveChapterRecords(chapter, tools);
  if (modelId.startsWith("stub:")) {
    const claim = evidence.claims[0];
    if (!claim) {
      return {
        conclusion: "",
        evidenceRefs: [],
        limitations: evidence.limitations,
        recommendation: "",
      };
    }
    return {
      conclusion: `${chapter.title}：${claim.statement}`,
      evidenceRefs: [
        {
          evidenceId: claim.id,
          value: claim.value,
          denominator: claim.denominator,
        },
      ],
      limitations: evidence.limitations,
      recommendation: "扩大有效样本，并在下一轮报告中复核该方向性信号。",
    };
  }

  let response = "";
  for await (const token of defaultGateway.streamChat({
    modelId,
    messages: [
      {
        role: "system",
        content:
          "你是专业调研分析师。只输出严格 JSON。必须从给定完整问卷事实和证据目录中取证，不得补数，不得把相关性写成因果。每条证据必须原样引用 evidenceId、value 和 denominator。",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "analyze_survey_report_chapter",
          chapter,
          requiredShape: {
            conclusion: "结论",
            evidenceRefs: [
              { evidenceId: "证据ID", value: 1, denominator: 10 },
            ],
            limitations: ["限制"],
            recommendation: "行动建议",
          },
          retrievedRecords,
          evidence,
        }),
      },
    ],
    settings: {
      agentId: "survey-report-analysis",
      toolIds: ["read_file", "grep"],
    },
  })) {
    response += token;
  }

  const parsed = parseJsonObject(response);
  return {
    conclusion: String(parsed.conclusion ?? "").trim(),
    evidenceRefs: evidenceRefs(parsed.evidenceRefs),
    limitations: stringArray(parsed.limitations),
    recommendation: String(parsed.recommendation ?? "").trim(),
  };
}

export async function generateSurveyReportAgentClaims({
  snapshot,
  categories,
  evidence,
  modelId,
  maxModelCalls = categories.length,
  generateChapter = generateChapterWithGateway,
}: GenerateSurveyReportAgentClaimsInput): Promise<SurveyReportAgentClaimsResult> {
  const agentResult = await runSurveyReportAgent({
    snapshot,
    chapters: categories
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((category) => ({
        id: category.id,
        categoryKey: category.name.trim().toLowerCase(),
        title: category.name,
        goal: category.description,
        requirement: categoryRequirement(category),
      })),
    evidence: evidence.claims.map((claim) => ({
      id: claim.id,
      questionId: claim.questionId,
      label: claim.evidenceLabel,
      value: claim.value,
      denominator: claim.denominator,
    })),
    maxModelCalls,
    analyzeChapter: async ({ chapter, tools }) =>
      generateChapter({
        modelId,
        chapter,
        tools,
        evidence,
      }),
  });

  const claimsById = new Map(
    evidence.claims.map((claim) => [claim.id, claim])
  );
  const claims = agentResult.chapters.flatMap((chapter) => {
    if (chapter.status !== "accepted") return [];
    return chapter.evidenceRefs.flatMap((reference) => {
      const source = claimsById.get(reference.evidenceId);
      if (!source) return [];
      return [{
        statement: chapter.conclusion,
        evidenceId: reference.evidenceId,
        value: reference.value,
        denominator: reference.denominator,
        implication: chapter.limitations.join("；") || undefined,
        recommendation: chapter.recommendation,
      }];
    });
  });

  return {
    status: agentResult.status,
    stopReason: agentResult.stopReason,
    claims,
    chapterTitles: agentResult.chapters.map((chapter) => chapter.title),
    audit: agentResult.audit,
  };
}

export interface GenerateTemplateTextChapterViaAgentInput {
  chapterId: string;
  title: string;
  requirement: string;
  snapshot: SurveyReportSourceSnapshotLike;
  evidence: SurveyReportEvidenceBundle;
  modelId: string;
  generateChapter?: SurveyReportChapterGenerator;
}

export interface TemplateTextChapterAgentResult {
  headline: string;
  claims: AiEvidenceClaimCandidate[];
  invalid: boolean;
}

/**
 * Single-chapter variant of {@link generateSurveyReportAgentClaims} for the
 * template-driven report pipeline (survey-report-chapter-generation.ts):
 * runs the evidence-retrieval agent against the raw fact snapshot for just
 * one template chapter instead of batching every category at once.
 */
export async function generateTemplateTextChapterViaAgent({
  chapterId,
  title,
  requirement,
  snapshot,
  evidence,
  modelId,
  generateChapter = generateChapterWithGateway,
}: GenerateTemplateTextChapterViaAgentInput): Promise<TemplateTextChapterAgentResult> {
  const agentResult = await runSurveyReportAgent({
    snapshot,
    chapters: [
      {
        id: chapterId,
        categoryKey: chapterId,
        title,
        goal: requirement,
        requirement,
      },
    ],
    evidence: evidence.claims.map((claim) => ({
      id: claim.id,
      questionId: claim.questionId,
      label: claim.evidenceLabel,
      value: claim.value,
      denominator: claim.denominator,
    })),
    maxModelCalls: 1,
    analyzeChapter: async ({ chapter, tools }) =>
      generateChapter({ modelId, chapter, tools, evidence }),
  });

  const chapter = agentResult.chapters[0];
  if (!chapter || chapter.evidenceRefs.length === 0) {
    return { headline: title, claims: [], invalid: false };
  }
  if (chapter.status !== "accepted") {
    return { headline: title, claims: [], invalid: true };
  }

  const claimsById = new Map(
    evidence.claims.map((claim) => [claim.id, claim])
  );
  const claims = chapter.evidenceRefs.flatMap((reference) => {
    const source = claimsById.get(reference.evidenceId);
    if (!source) return [];
    return [{
      statement: chapter.conclusion,
      evidenceId: reference.evidenceId,
      value: reference.value,
      denominator: reference.denominator,
      implication: chapter.limitations.join("；") || undefined,
      recommendation: chapter.recommendation,
    }];
  });

  return { headline: title, claims, invalid: claims.length === 0 };
}
