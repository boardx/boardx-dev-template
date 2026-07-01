import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  addSurveyQuestion,
  createSurvey,
  createSurveyStore,
  generateSurveyReport,
  listSurveyTemplates,
  listOrCreateInitialSurvey,
  listSurveys,
  publishSurvey,
  submitSurveyResponse,
  updateSurveyQuestion,
} from "./survey-service";

describe("survey service", () => {
  it("provides scenario templates for quick survey creation", () => {
    const templates = listSurveyTemplates();

    expect(templates.length).toBeGreaterThanOrEqual(8);
    expect(templates.map((template) => template.id)).toContain("customer_satisfaction_nps");
    expect(templates.map((template) => template.category)).toEqual(
      expect.arrayContaining([
        "business_diagnosis",
        "customer_satisfaction",
        "employee_engagement",
        "product_feedback",
        "market_research",
        "brand_research",
        "event_feedback",
        "custom",
      ])
    );
    expect(
      templates.every((template) => template.sections.length > 0 && template.sections.some((section) => section.questions.length > 0))
    ).toBe(true);
  });

  it("initializes the default survey only once", async () => {
    const dir = await mkdtemp(join(tmpdir(), "boardx-survey-"));
    const store = createSurveyStore(join(dir, "surveys.json"));

    try {
      const input = {
        title: "默认商务调研",
        category: "business_diagnosis" as const,
        businessGoal: "识别业务机会",
        targetAudience: "企业客户",
      };
      const [first, second] = await Promise.all([
        listOrCreateInitialSurvey(store, input),
        listOrCreateInitialSurvey(store, input),
      ]);
      const persisted = await listSurveys(store);

      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      expect(persisted).toHaveLength(1);
      expect(first[0]?.survey.id).toBe(second[0]?.survey.id);
      expect(first[0]?.sections.map((section) => section.title)).toEqual([
        "第一部分：企业基本信息",
        "第二部分：数字化现状评估",
        "第三部分：挑战与优先级",
      ]);
      expect(first[0]?.questions.map((question) => question.title).slice(0, 2)).toEqual([
        "您所在企业的行业是？",
        "您所在企业的员工规模是？",
      ]);
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });

  it("creates, edits, publishes, collects, and reports a survey", async () => {
    const dir = await mkdtemp(join(tmpdir(), "boardx-survey-"));
    const store = createSurveyStore(join(dir, "surveys.json"));

    try {
      const created = await createSurvey(store, {
        title: "客户满意度跟踪",
        category: "customer_satisfaction",
        businessGoal: "识别客户服务体验短板",
        targetAudience: "最近 90 天内的付费客户",
        templateId: "customer_satisfaction_nps",
      });

      expect(created.survey.status).toBe("draft");
      expect(created.questions.map((item) => item.title)).toContain("您向朋友或同事推荐我们的可能性有多大？");
      expect(created.questions.length).toBeGreaterThanOrEqual(7);

      const question = await addSurveyQuestion(store, created.survey.id, {
        type: "satisfaction_score",
        title: "您对本次服务的满意度如何？",
        required: true,
        options: [
          { label: "非常不满意", value: "1", score: 1 },
          { label: "不满意", value: "2", score: 2 },
          { label: "一般", value: "3", score: 3 },
          { label: "满意", value: "4", score: 4 },
          { label: "非常满意", value: "5", score: 5 },
        ],
        analysisRole: "dimension",
        dimensionKey: "customer_satisfaction",
      });

      const edited = await updateSurveyQuestion(store, created.survey.id, question.id, {
        title: "您对本次服务体验的满意度如何？",
        required: true,
      });

      expect(edited.title).toBe("您对本次服务体验的满意度如何？");

      const published = await publishSurvey(store, created.survey.id);

      expect(published.survey.status).toBe("published");
      expect(published.shareLink.token).toMatch(/^s_/);
      expect(published.reportTemplate.sections.map((section) => section.type)).toContain(
        "dimension_analysis"
      );

      const response = await submitSurveyResponse(store, published.shareLink.token, {
        metadata: { device: "desktop", channel: "email" },
        durationSeconds: 320,
        answers: [
          {
            questionId: question.id,
            value: "5",
            optionIds: [question.options![4]!.id],
          },
        ],
      });

      expect(response.status).toBe("completed");

      const report = await generateSurveyReport(store, created.survey.id);

      expect(report.status).toBe("completed");
      expect(report.summary).toContain("共回收 1 份样本");
      expect(report.sections[0]?.metrics?.find((metric) => metric.label === "有效样本")?.value).toBe(
        "1"
      );
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
