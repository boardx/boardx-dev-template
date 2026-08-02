// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  buildProfessionalReportHtml,
  openVisualPdfExportWindow,
} from "./report-export";
import type { ProfessionalSurveyReportDocument } from "./survey-professional-report";
import type { PublicTemplateDrivenSurveyReport } from "./survey-template-report";

const report: ProfessionalSurveyReportDocument = {
  title: "学生成长调查分析报告",
  generatedAt: "2026-07-15T00:00:00.000Z",
  status: "directional",
  executiveSummary: {
    claims: [{
      id: "question-1-top",
      questionId: 1,
      statement: "女性回答占比较高。",
      evidenceLabel: "女",
      value: 6,
      denominator: 10,
      confidence: "low",
      directional: true,
    }],
  },
  methodology: {
    sampleSize: 10,
    questionCount: 1,
    confidence: "low",
    statement: "报告仅使用真实答卷。",
  },
  chapters: [{
    id: "question-1",
    title: "性别",
    questionId: 1,
    outputType: "chart",
    validResponseCount: 10,
    missingResponseCount: 0,
    chart: {
      questionId: 1,
      title: "性别",
      type: "bar",
      denominator: 10,
      denominatorLabel: "有效回答数",
      rows: [
        { label: "男", count: 4, percentage: 40 },
        { label: "女", count: 6, percentage: 60 },
      ],
    },
    claims: [],
    limitations: ["该题样本不足 30，结果仅作为方向性信号。"],
  }],
  limitations: ["有效样本少于 30 份，结论仅作为方向性信号。"],
  actions: [],
};

describe("buildProfessionalReportHtml", () => {
  it("renders an A4 evidence report without workspace-only content", () => {
    const html = buildProfessionalReportHtml(report);

    expect(html).toContain("@page");
    expect(html).toContain("学生成长调查分析报告");
    expect(html).toContain("有效样本");
    expect(html).not.toContain("有效回答 n=");
    expect(html).toContain("数据来源：真实问卷答卷");
    expect(html).toContain("方法与限制");
    expect(html).not.toContain("模拟数据");
    expect(html).not.toContain("预览维度");
    expect(html).not.toContain("AI 助手");
  });

  it("exports only template chapters in their saved order", () => {
    const templateReport: PublicTemplateDrivenSurveyReport = {
      schemaVersion: "template-driven-report-v1",
      title: "模板驱动报告",
      generatedAt: "2026-07-19T00:00:00.000Z",
      sourceRevision: "source-revision-1",
      status: "ready",
      templateSnapshot: {
        title: "模板驱动报告",
        description: "管理层阅读版",
        chapters: [
          { id: "summary", order: 1, title: "管理层摘要", outputType: "text", questionIds: [], analysisObjective: "提炼结论", analysisMethod: "证据归纳", requirement: "先结论" },
          { id: "trend", order: 2, title: "趋势对比", outputType: "chart", questionIds: [], chartTemplateId: "line-simple", analysisObjective: "比较趋势", analysisMethod: "分布对比", requirement: "给图表" },
          { id: "visual", order: 3, title: "场景视觉", outputType: "image", questionIds: [], analysisObjective: "呈现场景", analysisMethod: "研究视觉", requirement: "给图片" },
        ],
      },
      sample: { responseCount: 13, questionCount: 8, confidence: "medium" },
      methodology: { statement: "匿名聚合分析", evidenceScope: "仅使用绑定题目" },
      limitations: ["有效样本少于 30 份，结论仅作为方向性信号。"],
      chapters: [
        {
          chapterId: "summary",
          order: 1,
          title: "管理层摘要",
          requirement: "先结论",
          outputType: "text",
          headline: "关键结论",
          body: "证据化分析",
          claims: [],
          evidenceRefs: [],
          limitations: [],
        },
        {
          chapterId: "trend",
          order: 2,
          title: "趋势对比",
          requirement: "给图表",
          outputType: "chart",
          chartTemplateId: "line-simple",
          option: {},
          interpretation: "趋势解释",
          sampleSize: 13,
          evidenceRefs: [],
          limitations: [],
        },
        {
          chapterId: "visual",
          order: 3,
          title: "场景视觉",
          requirement: "给图片",
          outputType: "image",
          assetId: "visual",
          assetUrl: "/api/surveys/1/professional-report/a/images/visual",
          altText: "核心场景",
          caption: "根据聚合洞察生成",
          evidenceRefs: [],
          limitations: [],
        },
      ],
    };

    const html = buildProfessionalReportHtml(templateReport);

    expect(html.indexOf("管理层摘要")).toBeLessThan(html.indexOf("趋势对比"));
    expect(html.indexOf("趋势对比")).toBeLessThan(html.indexOf("场景视觉"));
    expect(html).toContain("趋势解释");
    expect(html).toContain("根据聚合洞察生成");
    expect(html).toContain("研究方法与证据口径");
    expect(html).toContain("匿名聚合分析");
    expect(html).toContain("仅使用绑定题目");
    expect(html.match(/有效样本少于 30 份/g)).toHaveLength(1);
    expect(html).not.toContain("有效回答 n=");
    expect(html).not.toContain("执行摘要");
  });
});

describe("openVisualPdfExportWindow", () => {
  it("serializes rendered chart canvases into the print document", async () => {
    const reportElement = document.createElement("article");
    reportElement.innerHTML = `
      <section>
        <h2>组织特征</h2>
        <div role="img" aria-label="组织特征图表"><canvas></canvas></div>
      </section>
    `;
    document.body.appendChild(reportElement);
    const canvas = reportElement.querySelector("canvas");
    expect(canvas).not.toBeNull();
    vi.spyOn(canvas!, "toDataURL").mockReturnValue(
      "data:image/png;base64,chart"
    );

    let writtenHtml = "";
    const print = vi.fn();
    const popup = {
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
        images: [],
      },
      focus: vi.fn(),
      print,
      setTimeout: vi.fn((callback: () => void) => {
        callback();
        return 1;
      }),
    };
    vi.spyOn(window, "open").mockReturnValue(
      popup as unknown as Window
    );

    expect(openVisualPdfExportWindow(reportElement, "协作效率报告"))
      .toBe(true);
    await Promise.resolve();

    expect(writtenHtml).toContain("组织特征");
    expect(writtenHtml).toContain("data:image/png;base64,chart");
    expect(writtenHtml).toContain('data-report-export-canvas="true"');
    expect(writtenHtml).toContain('alt="组织特征图表"');
    expect(print).toHaveBeenCalledOnce();
  });
});
