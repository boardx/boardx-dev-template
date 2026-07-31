import { describe, expect, it, vi } from "vitest";
import { buildSurveyReportEvidence } from "./survey-report-evidence";
import { buildSurveyReportTemplateSnapshot } from "./survey-template-report";
import {
  generateTemplateReportChapters,
  reportEvidenceRefs,
} from "./survey-report-chapter-generation";

const evidence = buildSurveyReportEvidence({
  survey: {
    title: "产品安全调研",
    description: "了解购买决策和安全信任",
    questions: [
      {
        id: 1,
        title: "是否购买过",
        type: "single",
        required: true,
        options: ["是", "否"],
      },
      {
        id: 2,
        title: "最关注的安全信息",
        type: "single",
        required: true,
        options: ["认证", "成分"],
      },
    ],
  },
  responses: [
    { id: 1, answers: { "1": "是", "2": "认证" } },
    { id: 2, answers: { "1": "是", "2": "成分" } },
    { id: 3, answers: { "1": "否", "2": "认证" } },
  ],
});

const snapshot = buildSurveyReportTemplateSnapshot({
  title: "产品安全调研报告",
  description: "管理层阅读版",
  categories: [
    {
      id: "summary",
      name: "管理层摘要",
      description: "",
      analysisObjective: "识别影响安全信任的首要因素。",
      analysisMethod: "比较各安全关注项的选择占比，并结合购买经历交叉解读。",
      requirement: "先给结论，再说明业务含义和下一步动作。",
      questionIds: [2],
      outputType: "text",
      inputModes: ["text"],
      prompt: "先给结论，再说明业务含义和下一步动作。",
      order: 1,
      isCustom: true,
    },
    {
      id: "trust-chart",
      name: "安全信任结构",
      description: "",
      analysisObjective: "呈现不同安全信息的关注结构。",
      analysisMethod: "使用选项分布进行构成分析，并标注有效样本量。",
      requirement: "选择最能体现安全关注差异的题目。",
      questionIds: [2],
      outputType: "chart",
      inputModes: ["chart"],
      chartTemplateId: "pie-simple",
      prompt: "选择最能体现安全关注差异的题目。",
      order: 2,
      isCustom: true,
    },
    {
      id: "scenario-image",
      name: "核心场景视觉",
      description: "",
      analysisObjective: "把核心信任场景转化为管理层可快速理解的视觉。",
      analysisMethod: "依据购买经历和安全关注的聚合发现生成研究视觉。",
      requirement: "生成克制、专业且不带文字数字的场景信息图。",
      questionIds: [1],
      outputType: "image",
      inputModes: ["image"],
      prompt: "生成克制、专业且不带文字数字的场景信息图。",
      order: 3,
      isCustom: true,
    },
  ],
});

describe("template report chapter generation", () => {
  it("generates every template chapter in order against one source revision", async () => {
    const callJson = vi.fn(async (input: { messages: Array<{ content: string }> }) => {
      const request = JSON.parse(input.messages[1]!.content) as {
        task: string;
      };
      if (request.task === "generate_template_text_chapter") {
        return {
          headline: "安全信任是当前购买决策的首要解释变量",
          claims: [{
            statement: "认证信息为占比最高的安全关注项。",
            evidenceId: "question-2-top",
            value: 2,
            denominator: 3,
            implication: "用户需要可验证的信任凭据。",
            recommendation: "优先强化认证信息披露。",
          }],
        };
      }
      return {
        questionId: 2,
        interpretation: "认证关注高于成分关注，安全证明应成为首要沟通内容。",
      };
    });
    const generateImage = vi.fn().mockResolvedValue({
      assetId: "scenario-image",
      objectKey: "survey-reports/7/59/artifact-id/scenario-image.png",
      altText: "消费者查看产品安全认证信息的专业场景图",
      caption: "根据匿名聚合洞察生成。",
    });

    const chapters = await generateTemplateReportChapters({
      snapshot,
      evidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson,
      generateImage,
    });

    expect(chapters.map((chapter) => [
      chapter.chapterId,
      chapter.order,
      chapter.outputType,
    ])).toEqual([
      ["summary", 1, "text"],
      ["trust-chart", 2, "chart"],
      ["scenario-image", 3, "image"],
    ]);
    expect(chapters[0]).toMatchObject({
      headline: "安全信任是当前购买决策的首要解释变量",
      evidenceRefs: ["question-2-top"],
    });
    expect(chapters[1]).toMatchObject({
      chartTemplateId: "pie-simple",
      interpretation: "认证关注高于成分关注，安全证明应成为首要沟通内容。",
      evidenceRefs: ["question-2-distribution"],
      sampleSize: 3,
    });
    expect(chapters[2]).toMatchObject({
      assetId: "scenario-image",
      evidenceRefs: ["question-1-top"],
    });
    expect(callJson).toHaveBeenCalledTimes(2);
    for (const call of callJson.mock.calls) {
      const request = JSON.parse(call[0].messages[1]!.content);
      expect(request.sourceRevision).toBe("source-revision-1");
      expect(request.chapter.analysisObjective).toBeTruthy();
      expect(request.chapter.analysisMethod).toBeTruthy();
      expect(request.chapter.requirement).toBeTruthy();
      if (request.task === "generate_template_text_chapter") {
        expect(request.evidence.questions.map(
          (question: { questionId: number }) => question.questionId
        )).toEqual([2]);
        expect(request.evidence.claims.map(
          (claim: { questionId: number }) => claim.questionId
        )).toEqual([2]);
      }
      if (request.task === "select_template_chart_evidence") {
        expect(request.candidates.map(
          (question: { questionId: number }) => question.questionId
        )).toEqual([2]);
      }
    }
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({
      artifactId: "artifact-id",
      chapterId: "scenario-image",
      prompt: expect.stringContaining("分析目标：把核心信任场景转化为管理层可快速理解的视觉。"),
    }));
    expect(generateImage).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining("分析方法：依据购买经历和安全关注的聚合发现生成研究视觉。"),
    }));
  });

  it("rejects unbound text claims and chart question IDs outside the evidence allowlist", async () => {
    const invalidClaim = vi.fn().mockResolvedValue({
      headline: "虚构结论",
      claims: [{
        statement: "虚构",
        evidenceId: "missing",
        value: 99,
        denominator: 100,
      }],
    });
    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [snapshot.chapters[0]!],
      },
      evidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson: invalidClaim,
      generateImage: vi.fn(),
    })).rejects.toMatchObject({
      name: "SurveyReportChapterGenerationError",
      chapterId: "summary",
      chapterTitle: "管理层摘要",
      reason: "report_text_evidence_invalid",
    });

    const invalidChart = vi.fn().mockResolvedValue({
      questionId: 999,
      interpretation: "不存在的题目",
    });
    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [snapshot.chapters[1]!],
      },
      evidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson: invalidChart,
      generateImage: vi.fn(),
    })).rejects.toMatchObject({
      name: "SurveyReportChapterGenerationError",
      chapterId: "trust-chart",
      chapterTitle: "安全信任结构",
      reason: "report_chart_evidence_invalid",
    });
  });

  it("rejects chapters without explicitly selected question sources", async () => {
    const callJson = vi.fn();

    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [{
          ...snapshot.chapters[0]!,
          questionIds: [],
        }],
      },
      evidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson,
      generateImage: vi.fn(),
    })).rejects.toThrow("report_template_chapter_sources_missing:summary");

    expect(callJson).not.toHaveBeenCalled();
  });

  it("rejects stale question references before invoking any generator", async () => {
    const callJson = vi.fn();
    const generateImage = vi.fn();

    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [{
          ...snapshot.chapters[0]!,
          questionIds: [2, 999],
        }],
      },
      evidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson,
      generateImage,
    })).rejects.toThrow(
      "report_template_chapter_sources_unavailable:summary:999"
    );

    expect(callJson).not.toHaveBeenCalled();
    expect(generateImage).not.toHaveBeenCalled();
  });

  it("rejects chart chapters without distribution-compatible question sources", async () => {
    const textEvidence = buildSurveyReportEvidence({
      survey: {
        title: "开放反馈",
        description: "收集详细建议",
        questions: [{
          id: 3,
          title: "请说明原因",
          type: "short_text",
          required: true,
          options: [],
        }],
      },
      responses: [
        { id: 1, answers: { "3": "认证说明不够清楚" } },
      ],
    });
    const callJson = vi.fn();

    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [{
          ...snapshot.chapters[1]!,
          questionIds: [3],
        }],
      },
      evidence: textEvidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson,
      generateImage: vi.fn(),
    })).rejects.toThrow(
      "report_template_chart_sources_incompatible:trust-chart"
    );

    expect(callJson).not.toHaveBeenCalled();
  });

  it("rejects text chapters when selected sources have no anonymous aggregate claims", async () => {
    const textEvidence = buildSurveyReportEvidence({
      survey: {
        title: "开放反馈",
        description: "收集详细建议",
        questions: [{
          id: 3,
          title: "请说明原因",
          type: "short_text",
          required: true,
          options: [],
        }],
      },
      responses: [
        { id: 1, answers: { "3": "认证说明不够清楚" } },
      ],
    });
    const callJson = vi.fn();

    await expect(generateTemplateReportChapters({
      snapshot: {
        ...snapshot,
        chapters: [{
          ...snapshot.chapters[0]!,
          questionIds: [3],
        }],
      },
      evidence: textEvidence,
      sourceRevision: "source-revision-1",
      teamId: 7,
      surveyId: 59,
      artifactId: "artifact-id",
      model: "qwen-test",
    }, {
      callJson,
      generateImage: vi.fn(),
    })).rejects.toThrow(
      "report_template_text_sources_incompatible:summary"
    );

    expect(callJson).not.toHaveBeenCalled();
  });

  it("exposes only validated claim and aggregate distribution evidence references", () => {
    expect(reportEvidenceRefs(evidence)).toEqual(new Set([
      "question-1-top",
      "question-2-top",
      "question-1-distribution",
      "question-2-distribution",
    ]));
  });
});
