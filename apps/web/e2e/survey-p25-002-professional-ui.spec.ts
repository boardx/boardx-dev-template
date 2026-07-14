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

  await page.goto("/surveys");
  await expect(page.getByTestId("survey-professional-dashboard")).toBeVisible();
  await expect(page.getByTestId("survey-source-sidebar")).toContainText("BoardX Survey");
  await expect(page.getByTestId("survey-operations-list")).toBeVisible();
  await expect(page.getByTestId(`survey-${survey.id}`)).toBeVisible();

  await page.goto("/surveys?view=templates");
  await expect(page.getByTestId("templates-workbench")).toBeVisible();
  await page.goto("/surveys");
  await page.getByTestId("tab-ai-create").click();
  await expect(page.getByTestId("ai-create-workbench")).toBeVisible();
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

test("editor shell groups command buttons, question builder, inspector, and action feedback", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);

  await page.goto("/surveys");
  await page.getByTestId(`survey-${survey.id}`).dblclick();
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("editor-command-bar")).toBeVisible();
  await expect(page.getByTestId("question-builder-panel")).toBeVisible();
  await expect(page.getByTestId("editor-inspector-panel")).toBeVisible();

  await page.getByTestId("editor-share").click();
  await expect(page.getByTestId("editor-action-message")).toContainText("链接");
  await page.getByTestId("preview-survey").click();
  await expect(page.getByTestId("survey-preview")).toBeVisible();
  await page.getByTestId("edit-survey").click();
  await page.getByTestId("survey-settings-tab").click();
  await expect(page.getByTestId("publish-settings-panel")).toBeVisible();
});

test("answer and acceptance small surfaces share the professional shell", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page, true);

  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("answer-professional-shell")).toBeVisible();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByTestId("err-answer")).toContainText("请完成必填题");
  await page.getByTestId("answer-rating-0-4").click();
  await page.getByTestId("answer-single-1-1").click();
  await page.getByTestId("submit-answer").click();
  await expect(page.getByTestId("answer-success")).toBeVisible();

  await page.goto("/surveys/acceptance");
  await expect(page.getByTestId("acceptance-professional-shell")).toBeVisible();
  await expect(page.getByTestId("survey-acceptance-panel")).toBeVisible();
});
