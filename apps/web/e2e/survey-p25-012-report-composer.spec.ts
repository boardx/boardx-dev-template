import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, prefix: string) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F12",
      email: `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

test("report categories fall back deterministically and remain owner-only", async ({ page }) => {
  await register(page, "p25_f12_owner");
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "小学生活调研",
      questions: [
        { title: "你对课堂满意吗？", type: "rating", required: true, options: [], category: "学习体验" },
        { title: "你最关注什么？", type: "multiple", required: false, options: ["作业", "活动"], category: "学习体验" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };
  const detail = await page.request.get(`/api/surveys/${survey.id}`);
  expect(detail.status()).toBe(200);
  const questionIds = ((await detail.json()).survey.questions as Array<{ id: number | string }>).map(({ id }) => String(id));

  const classified = await page.request.post(`/api/surveys/${survey.id}/report-categories`);
  expect(classified.status()).toBe(200);
  const payload = await classified.json();
  expect(payload.generatedBy).toMatch(/^(llm|default)$/);
  expect(payload.reportCategoryPlan.categories.length).toBeGreaterThan(0);
  expect(payload.reportCategoryPlan.categories.flatMap((category: { questionIds: Array<number | string> }) => category.questionIds.map(String))).toEqual(
    expect.arrayContaining(questionIds)
  );

  const reloaded = await page.request.get(`/api/surveys/${survey.id}/report-categories`);
  expect(reloaded.status()).toBe(200);
  expect((await reloaded.json()).reportCategoryPlan.categories.length).toBeGreaterThan(0);

  await register(page, "p25_f12_outsider");
  expect((await page.request.post(`/api/surveys/${survey.id}/report-categories`)).status()).toBe(403);
});

test("report template exposes chart image text layout and independent prompts", async ({ page }) => {
  await register(page, "p25_f12_layout");
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "学生成长调研",
      questions: [
        { title: "你的年级？", type: "single", required: true, options: ["一年级", "二年级"], category: "基础信息" },
        { title: "你的性别？", type: "single", required: true, options: ["男", "女"], category: "基础信息" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  await expect(page.getByTestId("report-layout-canvas")).toBeVisible();
  await expect(page.getByTestId("report-layout-module-chart")).toBeVisible();
  await expect(page.getByTestId("report-layout-module-image")).toBeVisible();
  await expect(page.getByTestId("report-layout-module-text")).toBeVisible();
  await expect(page.getByTestId("report-layout-prompt-chart")).toBeVisible();
  await expect(page.getByTestId("report-module-resize-larger")).toBeVisible();
});

test("professional report never invents evidence for an empty survey", async ({ page }) => {
  await register(page, "p25_f12_professional");
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "零样本专业报告",
      questions: [
        { title: "你的性别？", type: "single", required: true, options: ["男", "女"] },
        { title: "你的年级？", type: "single", required: true, options: ["一年级", "二年级"] },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  const reportResponse = await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  expect(reportResponse.status()).toBe(200);
  const report = (await reportResponse.json()).report;
  expect(report.emptyState).toBe("尚无真实答卷，无法生成分析结论。");
  expect(report.executiveSummary.claims).toEqual([]);
  expect(report.chapters.every((chapter: { chart?: unknown }) => chapter.chart === undefined)).toBe(true);

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("professional-report-document")).toContainText("尚无真实答卷", { timeout: 20_000 });
  await expect(page.getByTestId("professional-report-document")).not.toContainText("模拟数据");
  await expect(page.getByTestId("professional-report-document")).not.toContainText("预览维度");
});
