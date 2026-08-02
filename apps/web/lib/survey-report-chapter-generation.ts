import { buildSurveyReportChartOption } from "./survey-report-chart-templates";
import type {
  SurveyQuestionEvidence,
  SurveyReportEvidenceBundle,
} from "./survey-report-evidence";
import {
  type AiEvidenceClaimCandidate,
  modelSafeSurveyReportEvidence,
  validateEvidenceClaims,
} from "./survey-professional-report";
import type {
  SurveyReportTemplateChapterSnapshot,
  SurveyReportTemplateSnapshot,
  TemplateDrivenTextNarrative,
  TemplateDrivenReportChapter,
} from "./survey-template-report";
import { callQwenJson } from "./qwen";
import {
  generateAndStoreSurveyReportImage,
  type StoredSurveyReportImage,
} from "./wan-image";

interface GenerateTemplateReportChaptersInput {
  snapshot: SurveyReportTemplateSnapshot;
  evidence: SurveyReportEvidenceBundle;
  sourceRevision: string;
  teamId: string | number;
  surveyId: string | number;
  artifactId: string;
  model: string;
}

type ChapterJsonCaller = (
  input: Parameters<typeof callQwenJson>[0]
) => Promise<unknown>;

interface ChapterGenerationDependencies {
  callJson?: ChapterJsonCaller;
  generateImage?: (
    input: Parameters<typeof generateAndStoreSurveyReportImage>[0]
  ) => Promise<StoredSurveyReportImage>;
}

interface TextChapterResult {
  headline: string;
  narrative?: Partial<TemplateDrivenTextNarrative>;
  claims: AiEvidenceClaimCandidate[];
}

interface ChartChapterResult {
  questionId: number;
  interpretation: string;
}

export class SurveyReportChapterGenerationError extends Error {
  constructor(
    readonly chapterId: string,
    readonly chapterTitle: string,
    readonly reason: string
  ) {
    super(
      `report_template_chapter_generation_failed:${chapterId}:${reason}`
    );
    this.name = "SurveyReportChapterGenerationError";
  }
}

function distributionFor(question: SurveyQuestionEvidence) {
  return question.distribution ?? question.score?.distribution;
}

function evidenceForChapter(
  evidence: SurveyReportEvidenceBundle,
  chapter: SurveyReportTemplateChapterSnapshot
): SurveyReportEvidenceBundle {
  const selected = new Set(chapter.questionIds.map(Number));
  const questions = evidence.questions.filter((question) =>
    selected.has(Number(question.questionId))
  );
  const questionIds = new Set(questions.map((question) => question.questionId));
  const selectedClaims = evidence.claims.filter((claim) =>
    questionIds.has(claim.questionId)
  );
  const substantiveClaims = selectedClaims.filter(
    (claim) => !claim.id.endsWith("-response-rate")
  );
  return {
    ...evidence,
    survey: {
      ...evidence.survey,
      questionCount: questions.length,
    },
    questions,
    claims: substantiveClaims.length ? substantiveClaims : selectedClaims,
    limitations: [],
  };
}

function assertValidChapterSources(
  snapshot: SurveyReportTemplateSnapshot,
  evidence: SurveyReportEvidenceBundle
): void {
  for (const chapter of snapshot.chapters) {
    if (!chapter.questionIds.length) {
      throw new Error(`report_template_chapter_sources_missing:${chapter.id}`);
    }
    const availableQuestionIds = new Set(
      evidence.questions.map((question) => Number(question.questionId))
    );
    const unavailableQuestionIds = chapter.questionIds
      .map(Number)
      .filter((questionId) => !availableQuestionIds.has(questionId));
    if (unavailableQuestionIds.length) {
      throw new Error(
        `report_template_chapter_sources_unavailable:${chapter.id}:${unavailableQuestionIds.join(",")}`
      );
    }
    const chapterEvidence = evidenceForChapter(evidence, chapter);
    const hasCompatibleClaims = chapter.outputType === "image"
      ? chapterEvidence.claims.some((claim) => !claim.id.endsWith("-response-rate"))
      : chapterEvidence.claims.length > 0;
    if (
      (chapter.outputType === "text" || chapter.outputType === "image") &&
      !hasCompatibleClaims
    ) {
      throw new Error(
        `report_template_${chapter.outputType}_sources_incompatible:${chapter.id}`
      );
    }
    if (chapter.outputType !== "chart") continue;
    const hasChartEvidence = chapterEvidence.questions.some(
      (question) => Boolean(distributionFor(question)?.length)
    );
    if (!hasChartEvidence) {
      throw new Error(
        `report_template_chart_sources_incompatible:${chapter.id}`
      );
    }
  }
}

export function reportEvidenceRefs(
  evidence: SurveyReportEvidenceBundle
): Set<string> {
  return new Set([
    ...evidence.claims.map((claim) => claim.id),
    ...evidence.questions.flatMap((question) =>
      distributionFor(question)?.length
        ? [`question-${question.questionId}-distribution`]
        : []
    ),
  ]);
}

function requestMessages(request: Record<string, unknown>) {
  return [
    {
      role: "system" as const,
      content:
        "你是严谨的问卷研究分析师。必须逐项执行章节中的分析目标、分析方法和自然语言要求；只能使用输入中的匿名聚合证据，不得虚构数字、样本或因果关系。输出必须是合法 JSON。",
    },
    {
      role: "user" as const,
      content: JSON.stringify(request),
    },
  ];
}

function requiredTextNarrative(
  result: TextChapterResult
): TemplateDrivenTextNarrative {
  const narrative = result.narrative;
  const conclusion = String(narrative?.conclusion ?? "").trim();
  const analysis = String(narrative?.analysis ?? "").trim();
  const recommendation = String(narrative?.recommendation ?? "").trim();
  if (!conclusion || !analysis || !recommendation) {
    throw new Error("report_text_template_execution_invalid");
  }
  return { conclusion, analysis, recommendation };
}

function chapterBase(
  chapter: SurveyReportTemplateChapterSnapshot,
  evidenceRefs: string[],
  limitations: string[]
) {
  return {
    chapterId: chapter.id,
    order: chapter.order,
    title: chapter.title,
    requirement: chapter.requirement,
    evidenceRefs,
    limitations,
  };
}

async function generateTextChapter(
  input: GenerateTemplateReportChaptersInput,
  chapter: SurveyReportTemplateChapterSnapshot,
  callJson: ChapterJsonCaller
): Promise<TemplateDrivenReportChapter> {
  const chapterEvidence = evidenceForChapter(input.evidence, chapter);
  const result = await callJson({
    model: input.model,
    temperature: 0.2,
    messages: requestMessages({
      task: "generate_template_text_chapter",
      sourceRevision: input.sourceRevision,
      chapter,
      templateExecution: {
        analysisObjective: chapter.analysisObjective,
        analysisMethod: chapter.analysisMethod,
        requirement: chapter.requirement,
        mandatory: true,
      },
      outputContract: {
        headline: "string",
        narrative: {
          conclusion: "string",
          analysis: "string that follows chapter.analysisMethod",
          recommendation: "string",
        },
        claims: [{
          statement: "string",
          evidenceId: "must match evidence.claims[].id",
          value: "must equal evidence claim value",
          denominator: "must equal evidence claim denominator",
          implication: "optional string",
          recommendation: "optional string",
        }],
      },
      evidence: modelSafeSurveyReportEvidence(chapterEvidence),
    }),
  }) as TextChapterResult;
  const candidates = Array.isArray(result.claims) ? result.claims : [];
  const claims = validateEvidenceClaims(chapterEvidence, candidates);
  if (candidates.length > 0 && claims.length === 0) {
    throw new Error("report_text_evidence_invalid");
  }
  const narrative = requiredTextNarrative(result);

  return {
    ...chapterBase(
      chapter,
      claims.map((claim) => claim.id),
      chapterEvidence.limitations
    ),
    outputType: "text",
    headline: String(result.headline ?? "").trim() || chapter.title,
    body: [
      narrative.conclusion,
      narrative.analysis,
      narrative.recommendation,
    ].join("\n\n"),
    narrative,
    claims,
  };
}

async function generateChartChapter(
  input: GenerateTemplateReportChaptersInput,
  chapter: SurveyReportTemplateChapterSnapshot,
  callJson: ChapterJsonCaller
): Promise<TemplateDrivenReportChapter> {
  if (!chapter.chartTemplateId) {
    throw new Error("report_template_chart_missing");
  }
  const chapterEvidence = evidenceForChapter(input.evidence, chapter);
  const candidates = chapterEvidence.questions.filter(
    (question) => Boolean(distributionFor(question)?.length)
  );
  const result = await callJson({
    model: input.model,
    temperature: 0.1,
    messages: requestMessages({
      task: "select_template_chart_evidence",
      sourceRevision: input.sourceRevision,
      chapter,
      outputContract: {
        questionId: "must match candidates[].questionId",
        interpretation: "string grounded in the selected aggregate distribution",
      },
      candidates,
      survey: input.evidence.survey,
      sample: input.evidence.sample,
    }),
  }) as ChartChapterResult;
  const question = candidates.find(
    (candidate) =>
      Number(candidate.questionId) === Number(result.questionId)
  );
  const rows = question ? distributionFor(question) : undefined;
  if (!question || !rows?.length) {
    throw new Error("report_chart_evidence_invalid");
  }

  return {
    ...chapterBase(
      chapter,
      [`question-${question.questionId}-distribution`],
      chapterEvidence.limitations
    ),
    outputType: "chart",
    chartTemplateId: chapter.chartTemplateId,
    option: buildSurveyReportChartOption(chapter.chartTemplateId, rows),
    interpretation: String(result.interpretation ?? "").trim(),
    sampleSize: question.validResponseCount,
  };
}

async function generateImageChapter(
  input: GenerateTemplateReportChaptersInput,
  chapter: SurveyReportTemplateChapterSnapshot,
  generateImage: NonNullable<ChapterGenerationDependencies["generateImage"]>
): Promise<TemplateDrivenReportChapter> {
  const chapterEvidence = evidenceForChapter(input.evidence, chapter);
  const aggregateClaims = chapterEvidence.claims;
  const evidenceRefs = aggregateClaims.map((claim) => claim.id);
  const insight = aggregateClaims.map((claim) => claim.statement).join("；");
  const altText = `${chapter.title}的专业研究场景图`;
  const caption = "根据问卷匿名聚合洞察生成，不代表原始受访者。";
  const image = await generateImage({
    prompt: [
      "生成专业、克制、适合管理层研究报告的横向场景信息图。",
      `章节：${chapter.title}。`,
      `分析目标：${chapter.analysisObjective}`,
      `分析方法：${chapter.analysisMethod}`,
      `要求：${chapter.requirement}`,
      insight ? `匿名聚合洞察：${insight}` : "",
      "画面不得出现文字、数字、品牌标志、人物肖像或未经证据支持的统计结论。",
    ].filter(Boolean).join("\n"),
    teamId: input.teamId,
    surveyId: input.surveyId,
    artifactId: input.artifactId,
    chapterId: chapter.id,
    altText,
    caption,
  });

  return {
    ...chapterBase(chapter, evidenceRefs, chapterEvidence.limitations),
    outputType: "image",
    assetId: image.assetId,
    assetKey: image.objectKey,
    altText: image.altText,
    caption: image.caption,
  };
}

export async function generateTemplateReportChapters(
  input: GenerateTemplateReportChaptersInput,
  dependencies: ChapterGenerationDependencies = {}
): Promise<TemplateDrivenReportChapter[]> {
  assertValidChapterSources(input.snapshot, input.evidence);
  const callJson = dependencies.callJson ?? callQwenJson;
  const generateImage =
    dependencies.generateImage ?? generateAndStoreSurveyReportImage;
  const chapters: TemplateDrivenReportChapter[] = [];

  for (const chapter of input.snapshot.chapters) {
    try {
      if (chapter.outputType === "text") {
        chapters.push(await generateTextChapter(input, chapter, callJson));
      } else if (chapter.outputType === "chart") {
        chapters.push(await generateChartChapter(input, chapter, callJson));
      } else {
        chapters.push(await generateImageChapter(input, chapter, generateImage));
      }
    } catch (error) {
      if (error instanceof SurveyReportChapterGenerationError) throw error;
      throw new SurveyReportChapterGenerationError(
        chapter.id,
        chapter.title,
        error instanceof Error ? error.message : "chapter_generation_failed"
      );
    }
  }
  return chapters;
}
