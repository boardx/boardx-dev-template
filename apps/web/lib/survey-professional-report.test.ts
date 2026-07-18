import { describe, expect, it } from "vitest";
import { buildSurveyReportEvidence } from "./survey-report-evidence";
import {
  buildProfessionalReportDocument,
  modelSafeSurveyReportEvidence,
  rawTextResponsesFromSourceData,
  sanitizeProfessionalReportDocument,
  validateEvidenceClaims,
} from "./survey-professional-report";

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

  it("keeps raw text answers out of the browser report artifact", () => {
    const canary = "F16_RAW_RESPONSE_CANARY_7d4bba65";
    const evidence = buildSurveyReportEvidence({
      survey: {
        ...survey,
        questions: [
          ...survey.questions,
          {
            id: 3,
            title: "补充建议",
            type: "text" as const,
            required: false,
            options: [],
          },
        ],
      },
      responses: [{
        id: 1,
        answers: { "1": "女", "2": "一年级", "3": canary },
      }],
    });

    const report = buildProfessionalReportDocument({
      evidence,
      generatedAt: "2026-07-15T00:00:00.000Z",
    });

    expect(JSON.stringify(report)).not.toContain(canary);
    expect(report.chapters.find((chapter) => chapter.questionId === 3))
      .toMatchObject({ validResponseCount: 1, missingResponseCount: 0 });
  });

  it("keeps raw text answers out of the model prompt and rejects echoed raw text", () => {
    const canary = "F16_MODEL_RAW_CANARY_7d4bba65";
    const evidence = buildSurveyReportEvidence({
      survey: {
        ...survey,
        questions: [
          ...survey.questions,
          {
            id: 3,
            title: "补充建议",
            type: "text" as const,
            required: false,
            options: [],
          },
        ],
      },
      responses: [{
        id: 1,
        answers: { "1": "女", "2": "一年级", "3": canary },
      }],
    });

    expect(JSON.stringify(modelSafeSurveyReportEvidence(evidence)))
      .not.toContain(canary);
    expect(validateEvidenceClaims(evidence, [{
      statement: `合法数值，但泄漏原文：${canary}`,
      evidenceId: "question-1-top",
      value: 1,
      denominator: 1,
    }])).toEqual([]);
  });

  it("materializes exactly one selected output contract per report chapter", () => {
    const evidence = buildSurveyReportEvidence({
      survey,
      responses: [
        { id: 1, answers: { "1": "女", "2": "一年级" } },
        { id: 2, answers: { "1": "男", "2": "二年级" } },
      ],
    });
    const report = buildProfessionalReportDocument({
      evidence,
      generatedAt: "2026-07-15T00:00:00.000Z",
      reportPlan: {
        title: "学生成长报告",
        description: "管理层版本",
        categories: [
          {
            id: "profile-chart",
            name: "画像图表",
            description: "",
            requirement: "用图表展示画像。",
            questionIds: [1],
            outputType: "chart",
            inputModes: ["chart"],
            chartTemplateId: "pie-simple",
            prompt: "用图表展示画像。",
            order: 1,
            isCustom: false,
          },
          {
            id: "grade-text",
            name: "年级结论",
            description: "",
            requirement: "输出文字结论。",
            questionIds: [2],
            outputType: "text",
            inputModes: ["text"],
            prompt: "输出文字结论。",
            order: 2,
            isCustom: false,
          },
          {
            id: "overview-image",
            name: "总结配图",
            description: "",
            requirement: "生成不虚构人物的总结配图。",
            questionIds: [],
            outputType: "image",
            inputModes: ["image"],
            prompt: "生成不虚构人物的总结配图。",
            order: 3,
            isCustom: false,
          },
        ],
      },
    });

    expect(report.chapters).toHaveLength(3);
    expect(report.chapters[0]).toMatchObject({
      categoryId: "profile-chart",
      outputType: "chart",
      chartTemplateId: "pie-simple",
      chart: { templateId: "pie-simple" },
    });
    expect(report.chapters[1]).toMatchObject({
      categoryId: "grade-text",
      outputType: "text",
      chart: undefined,
    });
    expect(report.chapters[2]).toMatchObject({
      categoryId: "overview-image",
      outputType: "image",
      imagePrompt: "生成不虚构人物的总结配图。",
      chart: undefined,
    });
  });

  it("recursively redacts raw historical text from claims and actions", () => {
    const canary = "F16_HISTORICAL_RAW_CANARY_0af8";
    const rawResponses = rawTextResponsesFromSourceData({
      records: [
        { type: "question", id: 3, questionType: "text" },
        { type: "question", id: 4, questionType: "single" },
        {
          type: "response",
          answers: { "3": canary, "4": "安全" },
        },
      ],
    });
    const report = {
      title: "历史报告",
      executiveSummary: {
        claims: [{ statement: `摘要回显 ${canary}` }],
      },
      chapters: [{
        questionId: 3,
        claims: [{ implication: `章节回显 ${canary}` }],
      }],
      actions: [{ action: `行动回显 ${canary}` }],
    } as unknown as Parameters<typeof sanitizeProfessionalReportDocument>[0];

    const sanitized = sanitizeProfessionalReportDocument(report, rawResponses);

    expect(rawResponses).toEqual([canary]);
    expect(JSON.stringify(sanitized)).not.toContain(canary);
    expect(JSON.stringify(sanitized)).toContain("[开放题原文已脱敏]");
  });
});
