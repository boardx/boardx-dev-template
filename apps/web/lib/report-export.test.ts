import { describe, expect, it } from "vitest";
import { buildProfessionalReportHtml } from "./report-export";
import type { ProfessionalSurveyReportDocument } from "./survey-professional-report";

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
    expect(html).toContain("n=10");
    expect(html).toContain("数据来源：真实问卷答卷");
    expect(html).toContain("方法与限制");
    expect(html).not.toContain("模拟数据");
    expect(html).not.toContain("预览维度");
    expect(html).not.toContain("AI 助手");
  });
});
