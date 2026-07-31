import { expect, test, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

async function register(page: Page, suffix: string) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F25",
      email: `p25_f25_${suffix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "咨询项目诊断问卷",
      description: "验证题目可跨章节复用，并形成连续专业报告。",
      questions: [
        {
          title: "您对整体服务的满意度如何？",
          type: "rating",
          required: true,
          options: [],
          category: "满意度",
        },
        {
          title: "影响续约决策的首要因素是什么？",
          type: "multiple",
          required: true,
          options: ["价值感知", "服务响应", "产品能力"],
          category: "续约驱动",
        },
        {
          title: "您希望优先改善什么？",
          type: "text",
          required: false,
          options: [],
          category: "行动建议",
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as {
    id: number;
    questions: Array<{ id: number | string; title: string }>;
  };
}

test.afterAll(async () => {
  await closePool();
});

test("consultant can reuse questions across chapters and preview AI changes before applying", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await register(page, "template");
  const survey = await createSurvey(page);

  const savedBeforePreview = await page.request.get(
    `/api/surveys/${survey.id}/report-categories`,
  );
  expect(savedBeforePreview.status()).toBe(200);
  const savedPlanBeforePreview =
    (await savedBeforePreview.json()).reportCategoryPlan;
  const apiPreview = await page.request.post(
    `/api/surveys/${survey.id}/report-categories`,
    {
      data: {
        previewOnly: true,
        instruction: "面向咨询公司领导优化章节结构，但不要直接保存。",
        currentPlan: savedPlanBeforePreview,
      },
    },
  );
  expect(apiPreview.status()).toBe(200);
  expect((await apiPreview.json()).previewOnly).toBe(true);
  const savedAfterPreview = await page.request.get(
    `/api/surveys/${survey.id}/report-categories`,
  );
  expect(savedAfterPreview.status()).toBe(200);
  expect((await savedAfterPreview.json()).reportCategoryPlan).toEqual(
    savedPlanBeforePreview,
  );

  const aiPlan = {
    title: "管理层客户洞察报告",
    description: "围绕留存、价值和行动优先级形成决策报告。",
    categories: [
      {
        id: "retention-overview",
        name: "留存风险与价值感知",
        description: "组合满意度与续约驱动，识别主要风险。",
        analysisObjective: "识别最影响客户续约的风险与价值因素。",
        analysisMethod: "交叉比较满意度与续约驱动题目的聚合分布。",
        requirement: "面向咨询公司领导，给出风险排序、证据边界和短期动作。",
        questionIds: [
          Number(survey.questions[0]!.id),
          Number(survey.questions[1]!.id),
        ],
        outputType: "chart",
        inputModes: ["chart"],
        chartTemplateId: "bar-simple",
        prompt: "面向咨询公司领导，给出风险排序、证据边界和短期动作。",
        order: 1,
        isCustom: false,
      },
      {
        id: "action-roadmap",
        name: "改善优先级与行动路线",
        description: "结合续约驱动与开放反馈形成行动建议。",
        analysisObjective: "确定改善动作的优先级和执行路径。",
        analysisMethod: "综合续约驱动分布与开放反馈主题，按影响和可行性排序。",
        requirement: "按影响和可行性组织建议，明确负责人和验证指标。",
        questionIds: [
          Number(survey.questions[1]!.id),
          Number(survey.questions[2]!.id),
        ],
        outputType: "text",
        inputModes: ["text"],
        prompt: "按影响和可行性组织建议，明确负责人和验证指标。",
        order: 2,
        isCustom: false,
      },
    ],
  };

  let aiPreviewRequested = false;
  await page.route(`**/api/surveys/${survey.id}/report-categories`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    aiPreviewRequested = true;
    expect(route.request().postDataJSON()).toMatchObject({
      previewOnly: true,
      instruction: expect.stringContaining("咨询公司领导"),
      currentPlan: expect.objectContaining({
        categories: expect.any(Array),
      }),
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reportCategoryPlan: aiPlan,
        generatedBy: "llm",
        previewOnly: true,
      }),
    });
  });

  const categoryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET"
      && response.url().endsWith(
        `/api/surveys/${survey.id}/report-categories`,
      ),
  );
  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  expect((await categoryResponse).ok()).toBe(true);
  await expect(page.getByTestId("report-template-builder")).toBeVisible({
    timeout: 20_000,
  });

  const sources = page.getByTestId("report-question-sources");
  await expect(sources).toBeVisible();
  await expect(sources.getByText("同一道题可用于多个章节")).toBeVisible();
  await sources
    .getByRole("checkbox", { name: survey.questions[0]!.title })
    .check();

  await page.getByRole("button", { name: "添加章节" }).first().click();
  await sources
    .getByRole("checkbox", { name: survey.questions[0]!.title })
    .check();
  await sources
    .getByRole("checkbox", { name: survey.questions[1]!.title })
    .check();

  await page.getByTestId("report-ai-instruction").fill(
    "面向咨询公司领导，合并重复章节并增加续约风险与行动优先级分析。",
  );
  await page.getByRole("button", { name: "生成变更预览" }).click();
  const preview = page.getByTestId("report-ai-change-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("管理层客户洞察报告");
  await expect(preview).toContainText("2 个章节");
  expect(aiPreviewRequested).toBe(true);

  await expect(page.getByTestId("report-module-list")).not.toContainText(
    "留存风险与价值感知",
  );
  await preview.getByRole("button", { name: "应用建议" }).click();
  await expect(page.getByTestId("report-module-list")).toContainText(
    "留存风险与价值感知",
  );
  await expect(page.getByTestId("report-question-sources")).toContainText(
    "已选择 2 题",
  );
  await expect(page.getByTestId("report-analysis-objective-input"))
    .toHaveValue("识别最影响客户续约的风险与价值因素。");
  await expect(page.getByTestId("report-analysis-method-input"))
    .toHaveValue("交叉比较满意度与续约驱动题目的聚合分布。");

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/surveys/${survey.id}/report-categories`)
      && response.request().method() === "PATCH",
  );
  await page.getByTestId("save-report-plan").click();
  expect((await saveResponse).ok()).toBe(true);

  const persisted = await page.request.get(
    `/api/surveys/${survey.id}/report-categories`,
  );
  expect(persisted.status()).toBe(200);
  const saved = (await persisted.json()).reportCategoryPlan;
  expect(saved.categories[0].questionIds).toEqual([
    Number(survey.questions[0]!.id),
    Number(survey.questions[1]!.id),
  ]);
  expect(saved.categories[0]).toMatchObject({
    analysisObjective: "识别最影响客户续约的风险与价值因素。",
    analysisMethod: "交叉比较满意度与续约驱动题目的聚合分布。",
  });
  expect(saved.categories[1].questionIds).toEqual([
    Number(survey.questions[1]!.id),
    Number(survey.questions[2]!.id),
  ]);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-25/evidence/ai-iterable-report-template.png",
    fullPage: true,
  });
});

test("analysis report renders every saved chapter as one continuous document", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await register(page, "report");
  const survey = await createSurvey(page);
  const chapterTitles = [
    "管理层摘要",
    "客户价值与满意度",
    "续约驱动与风险",
    "建议与行动",
  ];
  const generatedAt = "2026-07-31T08:00:00.000Z";
  const report = {
    schemaVersion: "template-driven-report-v1",
    title: "客户经营诊断报告",
    generatedAt,
    sourceRevision: "source-f25",
    status: "ready",
    templateSnapshot: {
      title: "客户经营诊断报告",
      description: "面向咨询顾问与咨询公司领导的决策报告。",
      chapters: chapterTitles.map((title, index) => ({
        id: `chapter-${index + 1}`,
        order: index + 1,
        title,
        outputType: "text",
        requirement: `输出${title}的独有洞察。`,
      })),
    },
    sample: {
      responseCount: 118,
      questionCount: 3,
      confidence: "high",
    },
    chapters: chapterTitles.map((title, index) => ({
      chapterId: `chapter-${index + 1}`,
      order: index + 1,
      title,
      requirement: `输出${title}的独有洞察。`,
      outputType: "text",
      headline: `${title}核心判断`,
      body: `${title}仅呈现本维度的证据、业务含义和决策建议。`,
      claims: [],
      evidenceRefs: [],
      limitations: [],
    })),
  };
  const generation = {
    currentSourceRevision: "source-f25",
    currentRequirementHash: "requirement-f25",
    currentResponseCount: 118,
    stale: false,
    requirementChanged: false,
    currentArtifact: null,
    latestArtifact: null,
    versions: [],
  };

  await page.route(
    `**/api/surveys/${survey.id}/professional-report`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ report, generation }),
      });
    },
  );

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  const reportDocument = page.getByTestId("professional-report-document");
  await expect(reportDocument).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("professional-report-chapter-nav")).toBeVisible();
  await expect(
    reportDocument.locator(
      "section[data-testid^=professional-report-chapter-]",
    ),
  )
    .toHaveCount(4);
  await expect(reportDocument.getByText("有效样本", { exact: true })).toHaveCount(1);

  const sections = reportDocument.locator(
    "section[data-testid^=professional-report-chapter-]",
  );
  for (const [index, title] of chapterTitles.entries()) {
    await expect(sections.nth(index)).toContainText(title);
    await expect(sections.nth(index)).toContainText("仅呈现本维度");
  }

  await page.getByTestId("report-chapter-link-chapter-4").click();
  await expect(page).toHaveURL(/#report-chapter-chapter-4$/);
  const lastChapter = page.getByTestId("professional-report-chapter-chapter-4");
  await expect(lastChapter).toBeInViewport();
  expect(
    await reportDocument.evaluate(
      (element) => element.getBoundingClientRect().height > window.innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-25/evidence/continuous-professional-report.png",
    fullPage: true,
  });
});
