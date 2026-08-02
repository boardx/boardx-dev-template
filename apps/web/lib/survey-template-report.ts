import type {
  SurveyReportCategoryPlanInput,
  SurveyReportChartTemplateId,
  SurveyReportOutputType,
} from "@repo/data";
import type { ValidatedReportClaim } from "./survey-professional-report";

export const TEMPLATE_DRIVEN_REPORT_SCHEMA_VERSION =
  "template-driven-report-v1" as const;

export interface SurveyReportTemplateChapterSnapshot {
  id: string;
  order: number;
  title: string;
  questionIds: number[];
  outputType: SurveyReportOutputType;
  analysisObjective: string;
  analysisMethod: string;
  requirement: string;
  chartTemplateId?: SurveyReportChartTemplateId;
}

export interface SurveyReportTemplateSnapshot {
  title: string;
  description: string;
  chapters: SurveyReportTemplateChapterSnapshot[];
}

interface TemplateChapterBase {
  chapterId: string;
  order: number;
  title: string;
  requirement: string;
  evidenceRefs: string[];
  limitations: string[];
}

export interface TemplateDrivenTextNarrative {
  conclusion: string;
  analysis: string;
  recommendation: string;
}

export type TemplateDrivenReportChapter =
  | (TemplateChapterBase & {
      outputType: "text";
      headline: string;
      body: string;
      narrative?: TemplateDrivenTextNarrative;
      claims: ValidatedReportClaim[];
    })
  | (TemplateChapterBase & {
      outputType: "chart";
      chartTemplateId: SurveyReportChartTemplateId;
      option: Record<string, unknown>;
      interpretation: string;
      sampleSize: number;
    })
  | (TemplateChapterBase & {
      outputType: "image";
      assetId: string;
      assetKey: string;
      assetUrl?: string;
      altText: string;
      caption: string;
    });

export interface TemplateDrivenSurveyReport {
  schemaVersion: typeof TEMPLATE_DRIVEN_REPORT_SCHEMA_VERSION;
  title: string;
  generatedAt: string;
  sourceRevision: string;
  status: "empty" | "directional" | "ready";
  templateSnapshot: SurveyReportTemplateSnapshot;
  sample: {
    responseCount: number;
    questionCount: number;
    confidence: "none" | "low" | "medium" | "high";
  };
  methodology: {
    statement: string;
    evidenceScope: string;
  };
  limitations: string[];
  chapters: TemplateDrivenReportChapter[];
}

export type PublicTemplateDrivenReportChapter =
  | Exclude<TemplateDrivenReportChapter, { outputType: "image" }>
  | (Omit<
      Extract<TemplateDrivenReportChapter, { outputType: "image" }>,
      "assetKey"
    > & { assetUrl: string });

export interface PublicTemplateDrivenSurveyReport
  extends Omit<TemplateDrivenSurveyReport, "chapters"> {
  chapters: PublicTemplateDrivenReportChapter[];
}

export class SurveyReportChapterValidationError extends Error {
  constructor(
    readonly chapterId: string,
    readonly chapterTitle: string,
    readonly reason: string
  ) {
    super(`report_template_chapter_validation_failed:${chapterId}:${reason}`);
    this.name = "SurveyReportChapterValidationError";
  }
}

function normalizedRequirement(
  category: SurveyReportCategoryPlanInput["categories"][number]
): string {
  return category.requirement?.trim() || category.prompt.trim();
}

export function buildSurveyReportTemplateSnapshot(
  plan: SurveyReportCategoryPlanInput
): SurveyReportTemplateSnapshot {
  return {
    title: plan.title.trim(),
    description: plan.description.trim(),
    chapters: plan.categories
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((category, index) => {
        if (category.outputType === "chart" && !category.chartTemplateId) {
          throw new Error("report_template_chart_missing");
        }
        const chapter: SurveyReportTemplateChapterSnapshot = {
          id: category.id,
          order: index + 1,
          title: category.name.trim(),
          questionIds: [...category.questionIds],
          outputType: category.outputType,
          analysisObjective: category.analysisObjective?.trim()
            || `识别「${category.name.trim()}」相关反馈中最值得管理层关注的结论。`,
          analysisMethod: category.analysisMethod?.trim()
            || "基于章节绑定题目的匿名聚合结果进行描述性分析，并结合样本边界解读。",
          requirement: normalizedRequirement(category),
        };
        if (category.outputType === "chart") {
          chapter.chartTemplateId = category.chartTemplateId;
        }
        return chapter;
      }),
  };
}

function chapterValidationError(
  reason: string,
  expected?: SurveyReportTemplateChapterSnapshot,
  actual?: TemplateDrivenReportChapter
): SurveyReportChapterValidationError {
  return new SurveyReportChapterValidationError(
    expected?.id ?? actual?.chapterId ?? "unknown-chapter",
    expected?.title ?? actual?.title ?? "未知章节",
    reason
  );
}

function firstDuplicate<T>(items: T[], key: (item: T) => string): T | undefined {
  const seen = new Set<string>();
  return items.find((item) => {
    const value = key(item);
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function validateUniqueChapterIds(
  snapshot: SurveyReportTemplateSnapshot,
  chapters: TemplateDrivenReportChapter[]
): void {
  const duplicateExpected = firstDuplicate(
    snapshot.chapters,
    (chapter) => chapter.id
  );
  if (duplicateExpected) {
    throw chapterValidationError(
      "report_chapter_id_mismatch",
      duplicateExpected
    );
  }
  const duplicateActual = firstDuplicate(
    chapters,
    (chapter) => chapter.chapterId
  );
  if (duplicateActual) {
    throw chapterValidationError(
      "report_chapter_id_mismatch",
      snapshot.chapters.find((chapter) => chapter.id === duplicateActual.chapterId),
      duplicateActual
    );
  }
}

export function validateTemplateDrivenReport(
  snapshot: SurveyReportTemplateSnapshot,
  chapters: TemplateDrivenReportChapter[],
  allowedEvidenceRefs: ReadonlySet<string>
): void {
  if (chapters.length !== snapshot.chapters.length) {
    const index = Math.min(chapters.length, snapshot.chapters.length);
    throw chapterValidationError(
      "report_chapter_count_mismatch",
      snapshot.chapters[index] ?? snapshot.chapters.at(-1),
      chapters[index] ?? chapters.at(-1)
    );
  }
  validateUniqueChapterIds(snapshot, chapters);

  snapshot.chapters.forEach((expected, index) => {
    const chapter = chapters[index];
    if (
      !chapter
      || chapter.chapterId !== expected.id
      || chapter.order !== expected.order
      || chapter.title !== expected.title
    ) {
      throw chapterValidationError(
        "report_chapter_order_mismatch",
        expected,
        chapter
      );
    }
    if (chapter.outputType !== expected.outputType) {
      throw chapterValidationError(
        "report_chapter_output_type_mismatch",
        expected,
        chapter
      );
    }
    if (
      chapter.outputType === "chart"
      && (
        chapter.chartTemplateId !== expected.chartTemplateId
        || !chapter.option
      )
    ) {
      throw chapterValidationError(
        "report_chapter_chart_mismatch",
        expected,
        chapter
      );
    }
    if (
      chapter.outputType === "image"
      && (!chapter.assetId.trim() || !chapter.assetKey.trim())
    ) {
      throw chapterValidationError(
        "report_chapter_image_mismatch",
        expected,
        chapter
      );
    }
    if (
      chapter.evidenceRefs.some(
        (evidenceRef) => !allowedEvidenceRefs.has(evidenceRef)
      )
    ) {
      throw chapterValidationError(
        "report_chapter_evidence_mismatch",
        expected,
        chapter
      );
    }
  });
}

export function countDistinctTemplateQuestions(
  snapshot: SurveyReportTemplateSnapshot
): number {
  return new Set(
    snapshot.chapters.flatMap((chapter) => chapter.questionIds)
  ).size;
}

export function assembleTemplateDrivenReport(input: {
  title: string;
  generatedAt: string;
  sourceRevision: string;
  snapshot: SurveyReportTemplateSnapshot;
  chapters: TemplateDrivenReportChapter[];
  allowedEvidenceRefs: ReadonlySet<string>;
  sample: TemplateDrivenSurveyReport["sample"];
  limitations: string[];
}): TemplateDrivenSurveyReport {
  validateTemplateDrivenReport(
    input.snapshot,
    input.chapters,
    input.allowedEvidenceRefs
  );
  return {
    schemaVersion: TEMPLATE_DRIVEN_REPORT_SCHEMA_VERSION,
    title: input.title,
    generatedAt: input.generatedAt,
    sourceRevision: input.sourceRevision,
    status:
      input.sample.responseCount === 0
        ? "empty"
        : input.sample.confidence === "low"
          ? "directional"
          : "ready",
    templateSnapshot: input.snapshot,
    sample: input.sample,
    methodology: {
      statement:
        `基于 ${input.sample.responseCount} 份有效答卷，对 ${input.sample.questionCount} 道问卷题目的匿名聚合证据进行章节化分析。`,
      evidenceScope:
        "各章节仅使用模板显式绑定的题目；同一道题可在不同分析目标下重复使用，所有结论均受当前事实版本约束。",
    },
    limitations: Array.from(new Set(input.limitations)),
    chapters: input.chapters,
  };
}

export function materializeReportAssetUrls(
  report: TemplateDrivenSurveyReport,
  surveyId: string | number,
  artifactId: string
): PublicTemplateDrivenSurveyReport {
  const methodology = report.methodology ?? {
    statement:
      `基于 ${report.sample.responseCount} 份有效答卷，对 ${report.sample.questionCount} 道问卷题目的匿名聚合证据进行章节化分析。`,
    evidenceScope:
      "各章节仅使用模板显式绑定的题目；同一道题可在不同分析目标下重复使用，所有结论均受当前事实版本约束。",
  };
  return {
    ...report,
    methodology,
    limitations: report.limitations ?? [],
    chapters: report.chapters.map((chapter) => {
      if (chapter.outputType !== "image") return chapter;
      const { assetKey: _assetKey, ...publicChapter } = chapter;
      return {
        ...publicChapter,
        assetUrl:
          `/api/surveys/${encodeURIComponent(String(surveyId))}`
          + `/professional-report/${encodeURIComponent(artifactId)}`
          + `/images/${encodeURIComponent(chapter.assetId)}`,
      };
    }),
  };
}
