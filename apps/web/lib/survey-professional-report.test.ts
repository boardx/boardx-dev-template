import { describe, expect, it } from "vitest";
import { buildSurveyReportEvidence } from "./survey-report-evidence";
import { buildProfessionalReportDocument, validateEvidenceClaims } from "./survey-professional-report";

const survey = {
  title: "学生成长调查",
  description: "了解学生情况",
  questions: [
    { id: 1, title: "性别", type: "single" as const, required: true, options: ["男", "女"] },
    { id: 2, title: "年级", type: "single" as const, required: true, options: ["一年级", "二年级"] },
  ],
};

describe("professional survey report", () => {
  it("renders methodology and an empty state without executive claims for zero samples", () => {
    const evidence = buildSurveyReportEvidence({ survey, responses: [] });
    const report = buildProfessionalReportDocument({ evidence, generatedAt: "2026-07-15T00:00:00.000Z" });

    expect(report.executiveSummary.claims).toEqual([]);
    expect(report.emptyState).toBe("尚无真实答卷，无法生成分析结论。");
    expect(report.methodology.sampleSize).toBe(0);
    expect(report.chapters.every((chapter) => chapter.chart === undefined)).toBe(true);
  });

  it("rejects AI claims whose evidence reference or numeric value is invalid", () => {
    const evidence = buildSurveyReportEvidence({
      survey,
      responses: [{ id: 1, answers: { "1": "女", "2": "一年级" } }],
    });

    const validated = validateEvidenceClaims(evidence, [
      { statement: "女性占全部样本", evidenceId: "question-1-top", value: 1, denominator: 1 },
      { statement: "虚构结论", evidenceId: "missing", value: 99, denominator: 100 },
      { statement: "篡改数值", evidenceId: "question-1-top", value: 99, denominator: 1 },
    ]);

    expect(validated).toHaveLength(1);
    expect(validated[0]?.statement).toBe("女性占全部样本");
  });

  it("creates one chart per question with its own denominator", () => {
    const evidence = buildSurveyReportEvidence({
      survey,
      responses: [
        { id: 1, answers: { "1": "女", "2": "一年级" } },
        { id: 2, answers: { "1": "男", "2": "二年级" } },
      ],
    });
    const report = buildProfessionalReportDocument({ evidence, generatedAt: "2026-07-15T00:00:00.000Z" });

    expect(report.chapters.map((chapter) => chapter.chart?.questionId)).toEqual([1, 2]);
    expect(report.chapters.map((chapter) => chapter.chart?.denominator)).toEqual([2, 2]);
    expect(report.chapters[0]?.chart?.rows.map((row) => row.label)).toEqual(["男", "女"]);
    expect(report.chapters[1]?.chart?.rows.map((row) => row.label)).toEqual(["一年级", "二年级"]);
  });

  it("marks low-sample evidence claims as directional", () => {
    const evidence = buildSurveyReportEvidence({
      survey,
      responses: [{ id: 1, answers: { "1": "女", "2": "一年级" } }],
    });
    const report = buildProfessionalReportDocument({ evidence, generatedAt: "2026-07-15T00:00:00.000Z" });

    expect(report.executiveSummary.claims.every((claim) => claim.directional)).toBe(true);
    expect(report.limitations).toContain("有效样本少于 30 份，结论仅作为方向性信号。");
  });
});
