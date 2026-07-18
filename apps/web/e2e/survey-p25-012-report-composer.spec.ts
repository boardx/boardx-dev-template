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
  await page.setViewportSize({ width: 1440, height: 1000 });
  await register(page, "p25_f12_layout");
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "学生成长调研",
      questions: [
        { title: "你的年级？", type: "single", required: true, options: ["一年级", "二年级"], category: "基础信息" },
        { title: "你的性别？", type: "single", required: true, options: ["男", "女"], category: "基础信息" },
        { title: "你每周投入多少时间学习？", type: "single", required: true, options: ["少于 3 小时", "3-6 小时", "6 小时以上"], category: "学习投入" },
        { title: "你对课堂互动的满意度如何？", type: "rating", required: true, options: [], category: "课堂体验" },
        { title: "你能否及时获得老师和同伴的支持？", type: "rating", required: true, options: [], category: "支持资源" },
        { title: "你认为自己本学期最大的成长是什么？", type: "text", required: false, options: [], category: "成长反馈" },
        { title: "你愿意向同学推荐这门课程吗？", type: "nps", required: true, options: [], category: "推荐意愿" },
        { title: "你希望课程下一步优先改善什么？", type: "text", required: false, options: [], category: "开放建议" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };
  expect((await page.request.post(`/api/surveys/${survey.id}/report-categories`)).status()).toBe(200);

  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  await expect(page.getByTestId("report-module-list")).toBeVisible();
  await expect(page.getByTestId("report-module-preview")).toBeVisible();
  await expect(page.getByTestId("report-module-inspector")).toBeVisible();
  await expect(page.getByTestId("report-ai-assistant")).toBeVisible();
  await expect(page.getByRole("heading", { name: "报告模版 · 学生成长调研" })).toBeVisible();
  await expect(page.getByTestId("workflow-design")).toHaveCount(0);
  const [moduleListBox, modulePreviewBox, assistantBox] = await Promise.all([
    page.getByTestId("report-module-list").boundingBox(),
    page.getByTestId("report-module-preview").boundingBox(),
    page.getByTestId("report-module-inspector").boundingBox(),
  ]);
  expect(moduleListBox).not.toBeNull();
  expect(modulePreviewBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(moduleListBox!.x).toBeLessThan(modulePreviewBox!.x);
  expect(modulePreviewBox!.x).toBeLessThan(assistantBox!.x);
  expect(moduleListBox!.width).toBeGreaterThanOrEqual(300);
  expect(moduleListBox!.width).toBeLessThanOrEqual(325);
  expect(assistantBox!.width).toBeGreaterThanOrEqual(340);
  expect(assistantBox!.width).toBeLessThanOrEqual(365);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-report-template-viewport.png",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByTestId("report-layout-canvas")).toBeVisible();
  await expect(page.getByTestId("report-layout-module-chart")).toBeVisible();
  await page.getByTestId("report-layout-select-image").click();
  await expect(page.getByTestId("report-layout-module-image")).toBeVisible();
  await page.getByTestId("report-layout-select-text").click();
  await expect(page.getByTestId("report-layout-module-text")).toBeVisible();
  await page.getByTestId("report-layout-select-chart").click();
  await expect(page.getByTestId("report-layout-prompt-chart")).toBeVisible();
  await expect(page.getByTestId("report-module-resize-larger")).toBeVisible();
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-report-template-desktop.png",
    fullPage: true,
  });

  await page.getByTestId("report-tab-data").click();
  await expect(page.getByTestId("report-data-prompt")).toBeVisible();
  await expect(page.getByTestId("report-module-prompts")).toBeVisible();

  await page.getByTestId("report-ai-input").fill("面向董事会，先结论后证据。");
  await page.getByTestId("report-ai-send").click();
  await expect(page.locator("#report-category-prompt")).toHaveValue(/面向董事会，先结论后证据。/);

  await page.getByTestId("report-tab-mapping").click();
  await expect(page.getByTestId("report-mapping-panel")).toBeVisible();
});

test("report composer keeps preview first on tablet and mobile", async ({ page }) => {
  await register(page, "p25_f12_preview_first");
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "移动端报告编排问卷",
      questions: [{ title: "你对本次服务满意吗？", type: "rating", required: true, options: [] }],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  const builder = page.getByTestId("report-template-builder");
  const preview = page.getByTestId("report-module-preview");
  const outline = page.getByTestId("report-module-list");
  const inspector = page.getByTestId("report-ai-assistant");

  for (const viewport of [{ width: 768, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(builder).toBeVisible();
    const [previewBox, outlineBox, inspectorBox] = await Promise.all([preview.boundingBox(), outline.boundingBox(), inspector.boundingBox()]);
    expect(previewBox).not.toBeNull();
    expect(outlineBox).not.toBeNull();
    expect(inspectorBox).not.toBeNull();
    expect(previewBox!.y).toBeLessThan(outlineBox!.y);
    expect(outlineBox!.y).toBeLessThan(inspectorBox!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
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

  const generatedResponse = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: { instruction: "生成管理层报告" },
  });
  expect(generatedResponse.status()).toBe(200);
  expect((await generatedResponse.json()).report.executiveSummary.claims).toEqual([]);

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("professional-report-document")).toContainText("尚无真实答卷", { timeout: 20_000 });
  await expect(page.getByTestId("professional-report-document")).not.toContainText("模拟数据");
  await expect(page.getByTestId("professional-report-document")).not.toContainText("预览维度");
});
