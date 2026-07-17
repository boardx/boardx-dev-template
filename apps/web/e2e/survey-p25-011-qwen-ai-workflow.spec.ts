import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "Latest",
      email: `p25_f11_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

test("blank creation uses the latest boardx-survey workflow editor", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("header-create-blank").click();

  await expect(page.getByRole("button", { name: /设计问卷/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /报告模板/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /发布回收/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /查看答题/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /分析报告/ })).toBeVisible();
  await expect(page.getByTestId("template-library")).toBeVisible();
  await expect(page.getByTestId("category-manager")).toBeVisible();
  await expect(page.getByTestId("survey-scope")).toBeVisible();
  await expect(page.getByTestId("question-type-0").locator("option")).toHaveCount(14);
  await expect(page.getByTestId("question-category-select-0")).toBeVisible();
  await expect(page.getByTestId("question-up-0")).toBeVisible();
  await expect(page.getByTestId("question-down-0")).toBeVisible();
  await expect(page.getByTestId("question-delete-0")).toBeVisible();
  await expect(page.getByTestId("add-question")).toBeVisible();
});

test("selected survey opens the simplified AI-first design workbench", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "AI 工作台体验问卷",
      description: "验证折叠目录和 AI 变更操作",
      questions: [{ title: "你对课堂满意吗？", type: "rating", required: true, options: [] }],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  await page.goto(`/surveys?survey=${survey.id}&step=design`);
  await expect(page.getByTestId("survey-outline-toggle")).toBeVisible();
  await expect(page.getByTestId("survey-ai-panel")).toBeVisible();
  await expect(page.getByTestId("survey-ai-preview")).toBeVisible();
  await expect(page.getByTestId("survey-ai-apply")).toBeVisible();
});

test("Qwen fallback session remains recoverable and private to its actor", async ({ page }) => {
  await register(page);
  const generated = await page.request.post("/api/surveys/ai", {
    data: { command: "创建商品安全调研", model: "qwen-force-fail" },
  });
  expect(generated.status()).toBe(200);
  const body = await generated.json();
  expect(body.fallback).toEqual({ from: "qwen-force-fail", to: "mock-survey-fallback" });

  const bundle = await page.request.get(`/api/surveys/ai/sessions/${body.sessionId}`);
  expect(bundle.status()).toBe(200);
  expect((await bundle.json()).drafts[0].draft.intentCanvas).toBeTruthy();

  await register(page);
  expect((await page.request.get(`/api/surveys/ai/sessions/${body.sessionId}`)).status()).toBe(404);
});
