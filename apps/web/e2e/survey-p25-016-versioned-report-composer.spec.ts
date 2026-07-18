import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F16",
      email: `p25_f16_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

test("report composer uses whole-survey requirements and versioned generation", async ({ page }) => {
  await page.setViewportSize({ width: 1653, height: 1024 });
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "商品安全决策调研",
      questions: [
        {
          title: "你最关注哪类安全信息？",
          type: "single",
          required: true,
          options: ["成分", "认证"],
          category: "安全认知",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };
  expect(
    (await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()
  ).toBe(200);
  const detail = await page.request.get(`/api/surveys/${survey.id}`);
  const questionId = Number((await detail.json()).survey.questions[0].id);

  const categoriesResponse = await page.request.get(`/api/surveys/${survey.id}/report-categories`);
  const categoryPlan = (await categoriesResponse.json()).reportCategoryPlan;
  categoryPlan.categories[0].requirement = "面向管理层，先给结论，再说明证据边界和行动建议。";
  const savedPlan = await page.request.patch(`/api/surveys/${survey.id}/report-categories`, {
    data: categoryPlan,
  });
  expect(savedPlan.status()).toBe(200);

  const beforeGeneration = await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  const beforePayload = await beforeGeneration.json();
  expect(beforePayload.preview).toBe(true);
  expect(beforePayload.generation.versions).toHaveLength(0);

  const firstGeneration = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: {},
  });
  expect(firstGeneration.status()).toBe(200);
  const firstPayload = await firstGeneration.json();
  expect(firstPayload.reused).toBe(false);
  expect(firstPayload.generation.versions).toHaveLength(1);

  const reusedGeneration = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: {},
  });
  const reusedPayload = await reusedGeneration.json();
  expect(reusedPayload.reused).toBe(true);
  expect(reusedPayload.generation.versions).toHaveLength(1);

  const loadedPlanResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/report-categories`) &&
    response.request().method() === "GET"
  );
  const loadedReportResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/professional-report`) &&
    response.request().method() === "GET"
  );
  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  const loadedPlanPayload = await (await loadedPlanResponse).json();
  const loadedReportPayload = await (await loadedReportResponse).json();
  expect(loadedPlanPayload.reportCategoryPlan.categories[0].requirement).toBe(
    "面向管理层，先给结论，再说明证据边界和行动建议。"
  );
  expect(loadedReportPayload.generation.versions).toHaveLength(1);
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  await expect(page.getByTestId("report-module-list")).toBeVisible();
  await expect(page.getByTestId("report-requirement-panel")).toBeVisible();
  await expect(page.getByTestId("report-requirement-input")).toHaveValue(
    "面向管理层，先给结论，再说明证据边界和行动建议。"
  );
  await expect(page.getByTestId("report-preview-panel")).toBeVisible();
  await expect(page.getByTestId("professional-report-document")).toBeVisible();
  await expect(page.getByTestId("report-version-history")).toContainText("1 个版本");
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-16/evidence/survey-report-composer-desktop.png",
    fullPage: true,
  });
  await expect(page.getByText("问题来源", { exact: true })).toHaveCount(0);
  await expect(page.getByText("输出模块", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("report-mapping-panel")).toHaveCount(0);

  const [requirementBox, previewBox] = await Promise.all([
    page.getByTestId("report-requirement-panel").boundingBox(),
    page.getByTestId("report-preview-panel").boundingBox(),
  ]);
  expect(requirementBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(requirementBox!.x).toBeLessThan(previewBox!.x);

  const response = await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: { answers: { [String(questionId)]: "认证" } },
  });
  expect(response.status()).toBe(201);
  const staleResponse = await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  const stalePayload = await staleResponse.json();
  expect(stalePayload.generation.stale).toBe(true);
  expect(stalePayload.generation.latestArtifact.newResponseCount).toBe(1);

  const nextGeneration = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: {},
  });
  const nextPayload = await nextGeneration.json();
  expect(nextPayload.reused).toBe(false);
  expect(nextPayload.generation.versions).toHaveLength(2);

  await page.reload();
  await expect(page.getByTestId("report-version-history")).toContainText("2 个版本");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
});
