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
  claims: AiEvidenceClaimCandidate[];
}

interface ChartChapterResult {
  questionId: number;
  interpretation: string;
}

function distributionFor(question: SurveyQuestionEvidence) {
  return question.distribution ?? question.score?.distribution;
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
        "你是严谨的问卷研究分析师。只能使用输入中的匿名聚合证据，不得虚构数字、样本或因果关系。",
    },
    {
      role: "user" as const,
      content: JSON.stringify(request),
    },
  ];
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
  const result = await callJson({
    model: input.model,
    temperature: 0.2,
    messages: requestMessages({
      task: "generate_template_text_chapter",
      sourceRevision: input.sourceRevision,
      chapter,
      outputContract: {
        headline: "string",
        claims: [{
          statement: "string",
          evidenceId: "must match evidence.claims[].id",
          value: "must equal evidence claim value",
          denominator: "must equal evidence claim denominator",
          implication: "optional string",
          recommendation: "optional string",
        }],
      },
      evidence: modelSafeSurveyReportEvidence(input.evidence),
    }),
  }) as TextChapterResult;
  const candidates = Array.isArray(result.claims) ? result.claims : [];
  const claims = validateEvidenceClaims(input.evidence, candidates);
  if (candidates.length > 0 && claims.length === 0) {
    throw new Error("report_text_evidence_invalid");
  }
  const paragraphs = claims.flatMap((claim) => [
    claim.statement,
    claim.implication,
    claim.recommendation,
  ]).filter((value): value is string => Boolean(value?.trim()));

  return {
    ...chapterBase(
      chapter,
      claims.map((claim) => claim.id),
      input.evidence.limitations
    ),
    outputType: "text",
    headline: String(result.headline ?? "").trim() || chapter.title,
    body: paragraphs.join("\n\n"),
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
  const candidates = input.evidence.questions.filter(
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
    (candidate) => candidate.questionId === Number(result.questionId)
  );
  const rows = question ? distributionFor(question) : undefined;
  if (!question || !rows?.length) {
    throw new Error("report_chart_evidence_invalid");
  }

  return {
    ...chapterBase(
      chapter,
      [`question-${question.questionId}-distribution`],
      input.evidence.limitations
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
  const aggregateClaims = input.evidence.claims;
  const evidenceRefs = aggregateClaims.map((claim) => claim.id);
  const insight = aggregateClaims.map((claim) => claim.statement).join("；");
  const altText = `${chapter.title}的专业研究场景图`;
  const caption = "根据问卷匿名聚合洞察生成，不代表原始受访者。";
  const image = await generateImage({
    prompt: [
      "生成专业、克制、适合管理层研究报告的横向场景信息图。",
      `章节：${chapter.title}。`,
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
    ...chapterBase(chapter, evidenceRefs, input.evidence.limitations),
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
  const callJson = dependencies.callJson ?? callQwenJson;
  const generateImage =
    dependencies.generateImage ?? generateAndStoreSurveyReportImage;
  const chapters: TemplateDrivenReportChapter[] = [];

  for (const chapter of input.snapshot.chapters) {
    if (chapter.outputType === "text") {
      chapters.push(await generateTextChapter(input, chapter, callJson));
    } else if (chapter.outputType === "chart") {
      chapters.push(await generateChartChapter(input, chapter, callJson));
    } else {
      chapters.push(await generateImageChapter(input, chapter, generateImage));
    }
  }
  return chapters;
}
