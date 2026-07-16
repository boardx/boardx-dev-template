import { expect, test, type Page } from "@playwright/test";

const uniq = () => `sv15_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
}

async function createSurvey(page: Page, active = false) {
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "专业 UI 验收问卷",
      description: "验证统一风格、按钮反馈和跳转。",
      questions: [
        { title: "你对这次体验满意吗？", type: "rating", required: true, options: [] },
        { title: "希望重点优化哪里？", type: "single", required: true, options: ["首页", "AI 创建", "编辑器"] },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number; shareUrl: string };
  if (active) {
    const patched = await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } });
    expect(patched.status()).toBe(200);
  }
  return survey;
}

test("professional dashboard exposes unified entry points and workbench interactions", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);

  await page.goto("/surveys?view=my");
  await expect(page.getByTestId("survey-professional-dashboard")).toBeVisible();
  await expect(page.getByTestId("survey-source-sidebar")).toContainText("BoardX Survey");
  await expect(page.getByTestId("survey-operations-list")).toBeVisible();
  await expect(page.getByTestId(`survey-${survey.id}`)).toBeVisible();

  await page.goto("/surveys?view=templates");
  await expect(page.getByTestId("templates-workbench")).toBeVisible();
  await page.goto("/surveys");
  await expect(page.getByTestId("create-with-ai")).toBeVisible();
  await page.goto("/surveys/acceptance");
  await expect(page).toHaveURL(/\/surveys\/acceptance/);
});

test("AI creation studio validates empty send and shows draft actions", async ({ page }) => {
  await register(page);

  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await expect(page.getByTestId("ai-studio-layout")).toBeVisible();
  await expect(page.getByTestId("ai-intent-panel")).toContainText("目标");
  await expect(page.getByTestId("ai-draft-workbench")).toBeVisible();
  await expect(page.getByTestId("ai-send")).toBeDisabled();

  await page.getByTestId("ai-model").selectOption("mock-survey-fast");
  await page.getByTestId("ai-input").fill("生成一个商品反馈问卷，控制在 5 题以内，并需要报告大纲。");
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-draft-preview")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("preview-ai-draft")).toBeVisible();
  await expect(page.getByTestId("apply-ai-draft")).toBeVisible();
  await expect(page.getByTestId("publish-ai-draft")).toBeVisible();
});

test("editor shell groups the question builder, inspector, and unified paper preview", async ({ page }) => {
  await register(page);
  await page.route("**/api/survey-templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        templates: [
          {
            id: "product-safety-research",
            source: "built_in",
            name: "商品安全市场调研",
            category: "product_safety",
            title: "商品安全市场调研问卷",
            description: "商品安全、风险感知与购买顾虑。",
            estimatedMinutes: 4,
            questions: [{ title: "你的年龄段是？", type: "single", required: true, options: ["18岁以下", "18-24岁"] }],
          },
          {
            id: "market-demand-research",
            source: "built_in",
            name: "市场需求调研",
            category: "market_research",
            title: "市场需求调研问卷",
            description: "市场痛点、预算和购买触发因素。",
            estimatedMinutes: 5,
            questions: [{ title: "你目前如何解决这个问题？", type: "text", required: false, options: [] }],
          },
        ],
      }),
    });
  });

  await page.goto("/surveys");
  await page.getByTestId("empty-new-survey").click();
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("editor-command-bar")).toBeVisible();
  await expect(page.getByTestId("question-builder-panel")).toBeVisible();
  await expect(page.getByTestId("editor-inspector-panel")).toBeVisible();
  await expect(page.getByTestId("survey-responses-tab")).toHaveCount(0);
  await expect(page.getByTestId("survey-settings-tab")).toHaveCount(0);
  await expect(page.getByTestId("template-select")).toBeVisible();
  await page.getByTestId("template-tag-filter").selectOption("product_safety");
  await expect(page.getByTestId("template-select").locator("option")).toHaveCount(2);
  await page.getByTestId("template-select").selectOption("built_in:product-safety-research");
  await expect(page.getByTestId("survey-title")).toHaveValue("商品安全市场调研问卷");
  await page.getByTestId("question-type-0").selectOption("single");
  await page.getByTestId("question-add-option-0").click();

  await page.getByTestId("preview-survey").click();
  await expect(page.getByTestId("survey-preview")).toBeVisible();
  await expect(page.getByTestId("preview-brand-banner")).toBeVisible();
  await expect(page.getByTestId("survey-preview-sheet")).toHaveClass(/border-0/);
  await expect(page.getByTestId("survey-preview-sheet")).toHaveClass(/shadow-sm/);
  await expect(page.getByTestId("preview-question-list")).not.toHaveClass(/divide-y/);
  await expect(page.getByTestId("preview-question-list")).toHaveClass(/space-y-0/);
  await expect(page.getByTestId("preview-question-0")).not.toHaveClass(/rounded/);
  await expect(page.getByTestId("preview-question-0")).toHaveClass(/py-3/);
  await expect(page.getByTestId("preview-question-type-0")).toHaveText("（单选）");
  await expect(page.getByTestId("preview-option-0-0")).toHaveClass(/border-0/);
  await expect(page.getByTestId("preview-option-0-0")).toHaveClass(/bg-muted/);
  await page.getByTestId("edit-survey").click();
  await expect(page.getByTestId("question-builder-panel")).toBeVisible();
});

test("answer and acceptance small surfaces share the professional shell", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await register(page);
  const survey = await createSurvey(page, true);

  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("answer-brand-banner")).toBeVisible();
  await expect(page.getByTestId("answer-professional-shell")).toHaveClass(/border-0/);
  await expect(page.getByTestId("answer-professional-shell")).toHaveClass(/shadow-sm/);
  await expect(page.getByTestId("answer-question-list")).not.toHaveClass(/divide-y/);
  await expect(page.getByTestId("answer-question-list")).toHaveClass(/space-y-0/);
  await expect(page.getByTestId("answer-question-0")).not.toHaveClass(/rounded/);
  await expect(page.getByTestId("answer-question-0")).toHaveClass(/py-3/);
  await expect(page.getByTestId("answer-question-type-1")).toHaveText("（单选）");
  await expect(page.getByTestId("answer-option-1-0")).toHaveClass(/border-0/);
  await expect(page.getByTestId("answer-option-1-0")).toHaveClass(/bg-muted/);
  await page.getByTestId("submit-answer").click();
  await expect(page.getByTestId("err-answer")).toContainText("请完成必填题");
  await page.getByTestId("answer-rating-0-4").click();
  await page.getByTestId("answer-single-1-1").click();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByTestId("answer-success")).toBeVisible({ timeout: 20_000 });

  await page.goto("/surveys/acceptance");
  await expect(page.getByTestId("acceptance-professional-shell")).toBeVisible();
  await expect(page.getByTestId("survey-acceptance-panel")).toBeVisible();
});
