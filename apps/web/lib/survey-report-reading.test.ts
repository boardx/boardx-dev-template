import { describe, expect, it } from "vitest";
import type { PublicTemplateDrivenSurveyReport } from "./survey-template-report";
import { reportOutlineItems } from "./survey-report-reading";

const report: PublicTemplateDrivenSurveyReport = {
  schemaVersion: "template-driven-report-v1",
  title: "经营诊断报告",
  generatedAt: "2026-07-19T00:00:00.000Z",
  sourceRevision: "source-revision-1",
  status: "ready",
  templateSnapshot: {
    title: "经营诊断报告",
    description: "管理层阅读版",
    chapters: [
      {
        id: "summary",
        order: 1,
        title: "管理层摘要",
        outputType: "text",
        requirement: "先结论。",
      },
      {
        id: "trend",
        order: 2,
        title: "趋势对比",
        outputType: "chart",
        chartTemplateId: "line-simple",
        requirement: "展示趋势。",
      },
      {
        id: "visual",
        order: 3,
        title: "场景视觉",
        outputType: "image",
        requirement: "展示场景。",
      },
    ],
  },
  sample: {
    responseCount: 13,
    questionCount: 8,
    confidence: "medium",
  },
  chapters: [
    {
      chapterId: "summary",
      order: 1,
      title: "管理层摘要",
      requirement: "先结论。",
      outputType: "text",
      headline: "关键结论",
      body: "证据化内容",
      claims: [],
      evidenceRefs: [],
      limitations: [],
    },
    {
      chapterId: "trend",
      order: 2,
      title: "趋势对比",
      requirement: "展示趋势。",
      outputType: "chart",
      chartTemplateId: "line-simple",
      option: {},
      interpretation: "趋势说明",
      sampleSize: 13,
      evidenceRefs: [],
      limitations: [],
    },
    {
      chapterId: "visual",
      order: 3,
      title: "场景视觉",
      requirement: "展示场景。",
      outputType: "image",
      assetId: "visual",
      assetUrl: "/api/report/image",
      altText: "场景",
      caption: "聚合洞察生成",
      evidenceRefs: [],
      limitations: [],
    },
  ],
};

describe("template report reading model", () => {
  it("uses only the saved template chapters for the outline", () => {
    expect(reportOutlineItems(report)).toEqual([
      { id: "summary", label: "管理层摘要", outputType: "text" },
      { id: "trend", label: "趋势对比", outputType: "chart" },
      { id: "visual", label: "场景视觉", outputType: "image" },
    ]);
    expect(reportOutlineItems(report).map((item) => item.label))
      .not.toContain("执行摘要");
    expect(reportOutlineItems(report).map((item) => item.label))
      .not.toContain("研究方法");
  });
});
