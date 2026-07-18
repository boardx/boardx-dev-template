import { describe, expect, it, vi } from "vitest";
import type { SurveyReportCategoryInput } from "@repo/data";
import { generateSurveyReportAgentClaims } from "./survey-report-agent-adapter";

const snapshot = {
  surveyId: 58,
  sourceRevision: "survey-58-revision",
  contentHash: "content-hash",
  schemaVersion: "survey-source-v1",
  generatedAt: "2026-07-18T12:00:00.000Z",
  responseCount: 2,
  sourceData: {
    format: "survey-source.jsonl",
    records: [
      {
        type: "manifest",
        sourceRevision: "survey-58-revision",
        contentHash: "content-hash",
        responseCount: 2,
      },
      {
        type: "survey",
        id: 58,
        title: "产品反馈问卷",
        description: "了解完整使用体验",
      },
      {
        type: "question",
        id: 101,
        title: "你是否购买过此类商品？",
        category: "behavior",
      },
      {
        type: "response",
        id: 201,
        answers: { "101": "是" },
      },
      {
        type: "response",
        id: 202,
        answers: { "101": "否" },
      },
    ],
  },
};

const evidence = {
  survey: {
    title: "产品反馈问卷",
    description: "了解完整使用体验",
    questionCount: 1,
  },
  sample: {
    responseCount: 2,
    confidence: "low" as const,
  },
  questions: [
    {
      questionId: 101,
      title: "你是否购买过此类商品？",
      type: "single" as const,
      validResponseCount: 2,
      missingResponseCount: 0,
      distribution: [
        {
          label: "是",
          count: 1,
          percentage: 50,
          denominator: 2,
        },
        {
          label: "否",
          count: 1,
          percentage: 50,
          denominator: 2,
        },
      ],
    },
  ],
  claims: [
    {
      id: "question-101-top",
      questionId: 101,
      statement: "购买过与未购买过的回答数量相同。",
      evidenceLabel: "是",
      value: 1,
      denominator: 2,
      confidence: "low" as const,
      directional: true,
    },
  ],
  limitations: ["有效样本少于 30 份，结论仅作为方向性信号。"],
};

const categories: SurveyReportCategoryInput[] = [
  {
    id: "behavior",
    name: "behavior",
    description: "分析购买与使用行为",
    prompt: "识别关键行为模式",
    requirement: "先给结论，再说明证据、限制与行动建议。",
    questionIds: [101],
    outputType: "text",
    inputModes: ["text"],
    isCustom: false,
    order: 0,
  },
];

describe("survey report agent adapter", () => {
  it("gives every chapter the whole snapshot and returns validated claims", async () => {
    const generateChapter = vi.fn(async ({ tools }) => {
      const source = tools.readFile("/source/survey-source.jsonl");
      expect(source.match(/"type":"response"/g)).toHaveLength(2);
      return {
        conclusion: "购买行为呈现分化，需要扩大样本复核。",
        evidenceRefs: [
          {
            evidenceId: "question-101-top",
            value: 1,
            denominator: 2,
          },
        ],
        limitations: ["当前仅有 2 份样本"],
        recommendation: "扩大样本并按用户类型进行交叉分析",
      };
    });

    const result = await generateSurveyReportAgentClaims({
      snapshot,
      categories,
      evidence,
      modelId: "stub:survey-report",
      generateChapter,
    });

    expect(result.status).toBe("ready");
    expect(generateChapter).toHaveBeenCalledTimes(1);
    expect(result.claims).toEqual([
      expect.objectContaining({
        evidenceId: "question-101-top",
        value: 1,
        denominator: 2,
      }),
    ]);
  });

  it("does not expose invalid claims to the report document", async () => {
    const result = await generateSurveyReportAgentClaims({
      snapshot,
      categories,
      evidence,
      modelId: "stub:survey-report",
      generateChapter: async () => ({
        conclusion: "错误结论",
        evidenceRefs: [
          {
            evidenceId: "question-101-top",
            value: 2,
            denominator: 2,
          },
        ],
        limitations: [],
        recommendation: "不应采用",
      }),
    });

    expect(result.status).toBe("failed");
    expect(result.claims).toEqual([]);
  });

  it("returns a recoverable failed result when model analysis throws", async () => {
    const result = await generateSurveyReportAgentClaims({
      snapshot,
      categories,
      evidence,
      modelId: "stub:survey-report",
      generateChapter: async () => {
        throw new Error("provider unavailable");
      },
    });

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("evidence_validation_failed");
    expect(result.claims).toEqual([]);
  });

  it("uses a deterministic evidence-bound chapter generator for stub models", async () => {
    const result = await generateSurveyReportAgentClaims({
      snapshot,
      categories,
      evidence,
      modelId: "stub:survey-report",
    });

    expect(result.status).toBe("ready");
    expect(result.claims).toEqual([
      expect.objectContaining({
        evidenceId: "question-101-top",
        value: 1,
        denominator: 2,
      }),
    ]);
    expect(result.audit.sourceReads).toContain(
      "/source/survey-source.jsonl"
    );
  });
});
