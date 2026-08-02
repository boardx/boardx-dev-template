import { describe, expect, it } from "vitest";
import { buildSurveyReportEvidence } from "./survey-report-evidence";

const questions = [
  { id: 1, title: "性别", type: "single" as const, required: true, options: ["男", "女"] },
  { id: 2, title: "年级", type: "single" as const, required: true, options: ["一年级", "二年级"] },
  { id: 3, title: "关注事项", type: "multiple" as const, required: false, options: ["安全", "价格", "口碑"] },
  { id: 4, title: "满意度", type: "rating" as const, required: false, options: [] },
];

describe("buildSurveyReportEvidence", () => {
  it("does not invent values or claims when there are no responses", () => {
    const evidence = buildSurveyReportEvidence({
      survey: { title: "学生调查", description: "", questions },
      responses: [],
    });

    expect(evidence.sample.responseCount).toBe(0);
    expect(evidence.questions.every((question) => question.validResponseCount === 0)).toBe(true);
    expect(evidence.questions.flatMap((question) => question.distribution ?? [])).toEqual([]);
    expect(evidence.claims).toEqual([]);
    expect(evidence.limitations).toContain("尚无真实答卷，无法生成分析结论。");
  });

  it("keeps distributions isolated by question and preserves the denominator", () => {
    const evidence = buildSurveyReportEvidence({
      survey: { title: "学生调查", description: "", questions },
      responses: [
        { id: 1, answers: { "1": "男", "2": "一年级" } },
        { id: 2, answers: { "1": "女", "2": "二年级" } },
        { id: 3, answers: { "1": "女", "2": "二年级" } },
      ],
    });

    const gender = evidence.questions.find((question) => question.questionId === 1)!;
    const grade = evidence.questions.find((question) => question.questionId === 2)!;
    expect(gender.distribution?.map((row) => row.label)).toEqual(["男", "女"]);
    expect(grade.distribution?.map((row) => row.label)).toEqual(["一年级", "二年级"]);
    expect(gender.distribution?.every((row) => row.denominator === 3)).toBe(true);
    expect(grade.distribution?.every((row) => row.denominator === 3)).toBe(true);
  });

  it("uses responding people as the multiple-choice denominator", () => {
    const evidence = buildSurveyReportEvidence({
      survey: { title: "学生调查", description: "", questions },
      responses: [
        { id: 1, answers: { "3": ["安全", "价格"] } },
        { id: 2, answers: { "3": ["安全"] } },
        { id: 3, answers: {} },
      ],
    });

    const multiple = evidence.questions.find((question) => question.questionId === 3)!;
    expect(multiple.validResponseCount).toBe(2);
    expect(multiple.distribution).toEqual([
      { label: "安全", count: 2, percentage: 100, denominator: 2 },
      { label: "价格", count: 1, percentage: 50, denominator: 2 },
      { label: "口碑", count: 0, percentage: 0, denominator: 2 },
    ]);
  });

  it("marks reports with fewer than 30 responses as directional", () => {
    const evidence = buildSurveyReportEvidence({
      survey: { title: "学生调查", description: "", questions },
      responses: [{ id: 1, answers: { "1": "女", "4": 5 } }],
    });

    expect(evidence.sample.confidence).toBe("low");
    expect(evidence.limitations).toContain("有效样本少于 30 份，结论仅作为方向性信号。");
    expect(evidence.claims).toContainEqual(expect.objectContaining({
      id: "question-4-top",
      questionId: 4,
      evidenceLabel: "5",
      value: 1,
      denominator: 1,
    }));
  });

  it("creates aggregate coverage evidence for text questions without exposing answers", () => {
    const evidence = buildSurveyReportEvidence({
      survey: {
        title: "开放反馈",
        description: "",
        questions: [{
          id: 5,
          title: "请提出改进建议",
          type: "text",
          required: false,
          options: [],
        }],
      },
      responses: [
        { id: 1, answers: { "5": "统一信息入口" } },
        { id: 2, answers: {} },
      ],
    });

    expect(evidence.claims).toEqual([expect.objectContaining({
      id: "question-5-response-rate",
      questionId: 5,
      statement: "「请提出改进建议」收到 1 份有效文本反馈，占本次样本的 50%。",
      value: 1,
      denominator: 2,
    })]);
    expect(evidence.claims[0]?.statement).not.toContain("统一信息入口");
  });
});
