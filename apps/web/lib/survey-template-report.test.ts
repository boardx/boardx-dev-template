import { describe, expect, it } from "vitest";
import type { SurveyReportCategoryPlanInput } from "@repo/data";
import {
  assembleTemplateDrivenReport,
  buildSurveyReportTemplateSnapshot,
  materializeReportAssetUrls,
  validateTemplateDrivenReport,
  type TemplateDrivenReportChapter,
} from "./survey-template-report";

const reportPlan: SurveyReportCategoryPlanInput = {
  title: "经营诊断报告",
  description: "按管理层阅读顺序输出",
  categories: [
    {
      id: "visual",
      name: "场景视觉",
      description: "",
      analysisObjective: "说明核心使用场景如何影响产品选择。",
      analysisMethod: "综合开放题主题和使用场景分布生成研究视觉。",
      requirement: "生成体现核心使用场景的专业配图。",
      questionIds: [3],
      outputType: "image",
      inputModes: ["image"],
      prompt: "生成体现核心使用场景的专业配图。",
      order: 3,
      isCustom: true,
    },
    {
      id: "summary",
      name: "管理层摘要",
      description: "",
      analysisObjective: "提炼最影响经营决策的结论。",
      analysisMethod: "综合关键题目分布与高置信证据，按影响优先级归纳。",
      requirement: "先结论，再给证据和行动建议。",
      questionIds: [1],
      outputType: "text",
      inputModes: ["text"],
      prompt: "先结论，再给证据和行动建议。",
      order: 1,
      isCustom: true,
    },
    {
      id: "trend",
      name: "趋势对比",
      description: "",
      analysisObjective: "识别关键维度之间的结构差异。",
      analysisMethod: "对两个题目的选项分布进行对比分析，并标明样本边界。",
      requirement: "比较关键维度并标明样本量。",
      questionIds: [1, 2],
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "line-simple",
      prompt: "比较关键维度并标明样本量。",
      order: 2,
      isCustom: true,
    },
  ],
};

const textChapter: TemplateDrivenReportChapter = {
  chapterId: "summary",
  order: 1,
  title: "管理层摘要",
  requirement: "先结论，再给证据和行动建议。",
  outputType: "text",
  headline: "首要结论",
  body: "主要人群的反馈已形成一致方向。",
  claims: [],
  evidenceRefs: ["question-1-top"],
  limitations: [],
};

const chartChapter: TemplateDrivenReportChapter = {
  chapterId: "trend",
  order: 2,
  title: "趋势对比",
  requirement: "比较关键维度并标明样本量。",
  outputType: "chart",
  chartTemplateId: "line-simple",
  option: {
    xAxis: { type: "category", data: ["A", "B"] },
    yAxis: { type: "value" },
    series: [{ type: "line", data: [8, 5] }],
  },
  interpretation: "A 维度高于 B 维度。",
  sampleSize: 13,
  evidenceRefs: ["question-1-distribution"],
  limitations: [],
};

const imageChapter: TemplateDrivenReportChapter = {
  chapterId: "visual",
  order: 3,
  title: "场景视觉",
  requirement: "生成体现核心使用场景的专业配图。",
  outputType: "image",
  assetId: "asset-visual",
  assetKey: "survey-reports/7/59/report/visual.png",
  altText: "核心使用场景信息图",
  caption: "根据匿名聚合发现生成。",
  evidenceRefs: ["question-1-top"],
  limitations: [],
};

describe("template-driven survey report contract", () => {
  it("freezes the exact template chapter order and single output types", () => {
    const snapshot = buildSurveyReportTemplateSnapshot(reportPlan);

    expect(snapshot.chapters.map((chapter) => ({
      id: chapter.id,
      order: chapter.order,
      title: chapter.title,
      outputType: chapter.outputType,
    }))).toEqual([
      { id: "summary", order: 1, title: "管理层摘要", outputType: "text" },
      { id: "trend", order: 2, title: "趋势对比", outputType: "chart" },
      { id: "visual", order: 3, title: "场景视觉", outputType: "image" },
    ]);
    expect(snapshot.chapters[1]?.chartTemplateId).toBe("line-simple");
    expect(snapshot.chapters[0]).toMatchObject({
      analysisObjective: "提炼最影响经营决策的结论。",
      analysisMethod: "综合关键题目分布与高置信证据，按影响优先级归纳。",
    });
    expect(snapshot.chapters.map((chapter) => chapter.questionIds)).toEqual([
      [1],
      [1, 2],
      [3],
    ]);
    expect(snapshot.chapters[0]).not.toHaveProperty("chartTemplateId");
  });

  it("rejects missing, reordered, and output-type-mismatched chapters", () => {
    const snapshot = buildSurveyReportTemplateSnapshot(reportPlan);
    const allowedEvidenceRefs = new Set([
      "question-1-top",
      "question-1-distribution",
    ]);

    expect(() => validateTemplateDrivenReport(
      snapshot,
      [textChapter, chartChapter],
      allowedEvidenceRefs
    )).toThrow("report_chapter_count_mismatch");
    expect(() => validateTemplateDrivenReport(
      snapshot,
      [textChapter, imageChapter, chartChapter],
      allowedEvidenceRefs
    )).toThrow("report_chapter_order_mismatch");
    expect(() => validateTemplateDrivenReport(
      snapshot,
      [
        textChapter,
        { ...chartChapter, outputType: "text", headline: "错误类型", body: "错误" },
        imageChapter,
      ] as TemplateDrivenReportChapter[],
      allowedEvidenceRefs
    )).toThrow("report_chapter_output_type_mismatch");
  });

  it("rejects evidence outside the current fact revision", () => {
    const snapshot = buildSurveyReportTemplateSnapshot(reportPlan);

    expect(() => validateTemplateDrivenReport(
      snapshot,
      [{ ...textChapter, evidenceRefs: ["unknown-evidence"] }, chartChapter, imageChapter],
      new Set(["question-1-top", "question-1-distribution"])
    )).toThrow("report_chapter_evidence_mismatch");
  });

  it("assembles template chapters with one centralized methodology section", () => {
    const report = assembleTemplateDrivenReport({
      title: "经营诊断报告",
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceRevision: "source-revision-1",
      snapshot: buildSurveyReportTemplateSnapshot(reportPlan),
      chapters: [textChapter, chartChapter, imageChapter],
      allowedEvidenceRefs: new Set([
        "question-1-top",
        "question-1-distribution",
      ]),
      sample: {
        responseCount: 13,
        questionCount: 8,
        confidence: "medium",
      },
    });

    expect(report.schemaVersion).toBe("template-driven-report-v1");
    expect(report.chapters).toHaveLength(3);
    expect(report.chapters.map((chapter) => chapter.chapterId))
      .toEqual(["summary", "trend", "visual"]);
    expect(report).not.toHaveProperty("executiveSummary");
    expect(report.methodology).toEqual({
      statement: "基于 13 份有效答卷，对 8 道问卷题目的匿名聚合证据进行章节化分析。",
      evidenceScope: "各章节仅使用模板显式绑定的题目；同一道题可在不同分析目标下重复使用，所有结论均受当前事实版本约束。",
    });
    expect(report).not.toHaveProperty("actions");
  });

  it("exposes authorized image URLs without leaking storage object keys", () => {
    const report = assembleTemplateDrivenReport({
      title: "经营诊断报告",
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceRevision: "source-revision-1",
      snapshot: buildSurveyReportTemplateSnapshot(reportPlan),
      chapters: [textChapter, chartChapter, imageChapter],
      allowedEvidenceRefs: new Set([
        "question-1-top",
        "question-1-distribution",
      ]),
      sample: {
        responseCount: 13,
        questionCount: 8,
        confidence: "medium",
      },
    });

    const publicReport = materializeReportAssetUrls(report, 59, "artifact-id");

    expect(publicReport.chapters[2]).toMatchObject({
      assetId: "asset-visual",
      assetUrl:
        "/api/surveys/59/professional-report/artifact-id/images/asset-visual",
    });
    expect(publicReport.chapters[2]).not.toHaveProperty("assetKey");
    expect(JSON.stringify(publicReport)).not.toContain("survey-reports/");
  });

  it("hydrates centralized methodology for historical v1 artifacts", () => {
    const report = assembleTemplateDrivenReport({
      title: "经营诊断报告",
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceRevision: "source-revision-1",
      snapshot: buildSurveyReportTemplateSnapshot(reportPlan),
      chapters: [textChapter, chartChapter, imageChapter],
      allowedEvidenceRefs: new Set([
        "question-1-top",
        "question-1-distribution",
      ]),
      sample: {
        responseCount: 13,
        questionCount: 8,
        confidence: "medium",
      },
    });
    const historicalReport = {
      ...report,
      methodology: undefined,
    } as unknown as typeof report;

    expect(materializeReportAssetUrls(
      historicalReport,
      59,
      "artifact-id"
    ).methodology.statement).toContain("13 份有效答卷");
  });
});
