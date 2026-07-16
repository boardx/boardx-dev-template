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
  await expect(page.getByTestId("templates-workbench")).toBeVisible();
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

test("AI additions remain visible and append to the editable question list after apply", async ({ page }) => {
  await register(page);
  await page.route("**/api/surveys/ai", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "11111111-1111-4111-8111-111111111111",
        model: "qwen3.7-max",
        draft: {
          reply: "已补充 2 个问题。",
          summary: "补充商品安全使用场景和风险反馈。",
          title: "商品安全调研",
          description: "验证 AI 新增题目",
          questions: [
            { title: "你通常在哪些场景使用该商品？", type: "multiple", required: true, options: ["居家", "户外"], category: "使用场景" },
            { title: "你遇到过哪些安全问题？", type: "text", required: false, options: [], category: "风险反馈" },
          ],
          clarifyingQuestions: [],
          assumptions: [],
          reportOutline: [],
          reportTemplate: null,
          intentCanvas: {},
        },
      }),
    });
  });

  await page.goto("/surveys");
  await page.getByTestId("header-create-blank").click();
  await page.getByTestId("question-title-0").fill("你使用过该商品吗？");
  if (!(await page.getByTestId("ai-input").isVisible())) await page.getByTestId("open-ai-assistant").click();
  await page.getByTestId("ai-input").fill("添加 2 个商品安全问题");
  await page.getByTestId("ai-send").click();

  await expect(page.getByTestId("ai-draft-question-list")).toContainText("你通常在哪些场景使用该商品？");
  await expect(page.getByTestId("ai-draft-question-list")).toContainText("你遇到过哪些安全问题？");
  await page.getByTestId("apply-ai-draft").click();

  await expect(page.getByTestId("question-title-0")).toHaveValue("你使用过该商品吗？");
  await expect(page.getByTestId("question-title-1")).toHaveValue("你通常在哪些场景使用该商品？");
  await expect(page.getByTestId("question-title-2")).toHaveValue("你遇到过哪些安全问题？");
  await expect(page.getByTestId("ai-draft-question-list")).toBeVisible();
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
