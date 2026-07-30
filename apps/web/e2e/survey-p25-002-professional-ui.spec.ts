import { expect, test, type Page } from "@playwright/test";

const uniq = () => `sv15_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

const defaultQuestions = [
  { title: "你对这次体验满意吗？", type: "rating", required: true, options: [] },
  { title: "希望重点优化哪里？", type: "single", required: true, options: ["首页", "AI 创建", "编辑器"] },
];

const longMobileQuestions = Array.from({ length: 18 }, (_, index) => ({
  title: `移动端长问卷问题 ${index + 1}`,
  type: index === 0 ? "rating" : index === 1 ? "single" : "short_text",
  required: index < 2,
  options: index === 1 ? ["首页", "AI 创建", "编辑器"] : [],
}));

async function register(page: Page) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
}

async function createSurvey(page: Page, active = false, questions = defaultQuestions) {
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "专业 UI 验收问卷",
      description: "验证统一风格、按钮反馈和跳转。",
      questions,
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
  test.setTimeout(120_000);
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
  await page.getByTestId("create-with-ai").click();
  await expect(page.getByTestId("new-survey-dialog")).toBeVisible();
  await expect(page.getByTestId("new-survey-ai")).toBeVisible();
  await expect(page.getByTestId("new-survey-template")).toBeVisible();
  await expect(page.getByTestId("new-survey-blank")).toBeVisible();
  await page.goto("/surveys/acceptance");
  await expect(page).toHaveURL(/\/surveys\/acceptance/);
});

test("new survey chooser opens the current AI assistant", async ({ page }) => {
  await register(page);

  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-ai").click();
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  const assistant = page.getByTestId("survey-ai-assistant");
  await expect(assistant).toBeVisible();
  await expect(assistant).toContainText("AI 助手");
  await expect(assistant).toContainText("不会直接覆盖左侧问卷");
  await expect(assistant.getByTestId("ai-send")).toBeDisabled();
});

test("editor shell keeps the reference workflow, default AI assistant, and unified paper preview", async ({ page }) => {
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
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-blank").click();
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("editor-command-bar")).toHaveCount(0);
  await expect(page.getByTestId("survey-editor-stepper")).toBeVisible();
  await expect(page.getByTestId("question-builder-panel")).toBeVisible();
  await expect(page.getByTestId("survey-ai-assistant")).toBeVisible();
  await expect(page.getByTestId("editor-inspector-panel")).toHaveCount(0);
  await expect(page.getByTestId("survey-responses-tab")).toHaveCount(0);
  await expect(page.getByTestId("survey-settings-tab")).toHaveCount(0);
  await expect(page.getByTestId("template-select")).toBeHidden();
  await page.getByTestId("question-type-0").selectOption("single");
  await page.getByTestId("question-add-option-0").click();

  await page.getByTestId("preview-survey").click();
  await expect(page.getByTestId("survey-preview")).toBeVisible();
  await expect(page.getByTestId("preview-brand-banner")).toBeVisible();
  await expect(page.getByTestId("preview-question-type-0")).toHaveText("（单选）");
  const [previewSheet, previewQuestion, previewOption] = await Promise.all([
    page.getByTestId("survey-preview-sheet").boundingBox(),
    page.getByTestId("preview-question-0").boundingBox(),
    page.getByTestId("preview-option-0-0").boundingBox(),
  ]);
  expect(previewSheet).not.toBeNull();
  expect(previewQuestion).not.toBeNull();
  expect(previewOption).not.toBeNull();
  expect(previewQuestion!.x).toBeGreaterThan(previewSheet!.x);
  expect(previewQuestion!.width).toBeLessThan(previewSheet!.width);
  expect(previewOption!.x).toBeGreaterThanOrEqual(previewQuestion!.x);
  expect(previewOption!.x + previewOption!.width).toBeLessThanOrEqual(previewQuestion!.x + previewQuestion!.width);
  expect(previewOption!.y).toBeGreaterThan(previewQuestion!.y);
  await page.getByTestId("edit-survey").click();
  await expect(page.getByTestId("question-builder-panel")).toBeVisible();
});

test("saved survey keeps preview and save actions visible at the bottom of a long editor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await register(page);
  const survey = await createSurvey(
    page,
    false,
    Array.from({ length: 24 }, (_, index) => ({
      title: `编辑器长问卷问题 ${index + 1}`,
      type: index % 2 === 0 ? "single" : "short_text",
      required: index < 2,
      options: index % 2 === 0 ? ["选项 A", "选项 B"] : [],
    }))
  );

  await page.goto(`/surveys?survey=${survey.id}&step=design`);
  const workflowHeader = page.getByTestId("survey-workflow-header");
  const appScrollContainer = page.getByTestId("app-scroll-container");
  const workflowScrollContainer = page.getByTestId("survey-workflow-scroll-container");
  const saveButton = page.getByTestId("save-survey");

  await expect(workflowHeader).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("question-title-23")).toBeAttached({ timeout: 20_000 });
  await expect(saveButton).toHaveText("保存修改");
  await expect(page.getByTestId("editor-report-template")).toHaveCount(0);
  const headerBeforeScroll = await workflowHeader.boundingBox();
  expect(headerBeforeScroll).not.toBeNull();

  const workflowScrollMetrics = await workflowScrollContainer.evaluate((element) => {
    const maximum = element.scrollHeight - element.clientHeight;
    element.scrollTop = Math.max(0, maximum - 300);
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      maximum,
    };
  });
  expect(workflowScrollMetrics.scrollHeight).toBeGreaterThan(workflowScrollMetrics.clientHeight);
  expect(workflowScrollMetrics.scrollTop).toBeGreaterThan(0);
  const workflowScrollBox = await workflowScrollContainer.boundingBox();
  expect(workflowScrollBox).not.toBeNull();
  await page.mouse.move(
    workflowScrollBox!.x + workflowScrollBox!.width / 2,
    workflowScrollBox!.y + workflowScrollBox!.height / 2
  );
  await page.mouse.wheel(0, 200);
  await expect.poll(
    () => workflowScrollContainer.evaluate((element) => element.scrollTop)
  ).toBeGreaterThan(workflowScrollMetrics.scrollTop);
  await workflowScrollContainer.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.mouse.wheel(0, 4_000);
  await page.waitForTimeout(100);
  expect(await workflowScrollContainer.evaluate((element) => element.scrollTop))
    .toBe(workflowScrollMetrics.maximum);
  await expect(page.getByTestId("add-question")).toBeInViewport();
  await expect(workflowHeader).toBeInViewport();
  await expect(saveButton).toBeInViewport();
  expect(await appScrollContainer.evaluate((element) => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
  const headerAfterScroll = await workflowHeader.boundingBox();
  const viewport = page.viewportSize();
  expect(headerAfterScroll).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(headerAfterScroll!.y).toBe(headerBeforeScroll!.y);
  expect(headerAfterScroll!.height).toBe(headerBeforeScroll!.height);
  expect(headerAfterScroll!.y).toBeGreaterThanOrEqual(0);
  expect(headerAfterScroll!.y + headerAfterScroll!.height).toBeLessThanOrEqual(viewport!.height);

  await page.getByTestId("question-title-23").fill("编辑器底部保存已生效");
  await expect(saveButton).toBeEnabled();
  const saveResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith(`/api/surveys/${survey.id}`) && response.request().method() === "PATCH"
  );
  await saveButton.click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedSurvey = (await saveResponse.json()).survey as {
    questions: Array<{ title: string }>;
  };
  expect(savedSurvey.questions[23]?.title).toBe("编辑器底部保存已生效");
});

test("anonymous mobile respondents retain a visible submission action while scrolling a long survey", async ({ page, browser }) => {
  await register(page);
  const survey = await createSurvey(page, true, longMobileQuestions);
  const anonymousContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const anonymousPage = await anonymousContext.newPage();

  try {
    await anonymousPage.goto(survey.shareUrl);
    const mobileSubmit = anonymousPage.getByTestId("submit-answer-mobile");

    await expect(anonymousPage.getByTestId("answer-page")).toBeVisible();
    await expect(mobileSubmit).toBeInViewport();
    await anonymousPage.getByTestId("answer-question-9").scrollIntoViewIfNeeded();
    await expect(mobileSubmit).toBeInViewport();
    await anonymousPage.getByTestId("answer-question-17").scrollIntoViewIfNeeded();
    await expect(mobileSubmit).toBeInViewport();
  } finally {
    await anonymousContext.close();
  }
});

test("answer and acceptance small surfaces share the professional shell", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await register(page);
  const survey = await createSurvey(page, true);

  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("answer-brand-banner")).toBeVisible();
  await expect(page.getByTestId("answer-question-type-1")).toHaveText("（单选）");
  const [answerShell, answerQuestion, answerOption] = await Promise.all([
    page.getByTestId("answer-professional-shell").boundingBox(),
    page.getByTestId("answer-question-1").boundingBox(),
    page.getByTestId("answer-option-1-0").boundingBox(),
  ]);
  expect(answerShell).not.toBeNull();
  expect(answerQuestion).not.toBeNull();
  expect(answerOption).not.toBeNull();
  expect(answerQuestion!.x).toBeGreaterThan(answerShell!.x);
  expect(answerQuestion!.width).toBeLessThan(answerShell!.width);
  expect(answerOption!.x).toBeGreaterThanOrEqual(answerQuestion!.x);
  expect(answerOption!.x + answerOption!.width).toBeLessThanOrEqual(answerQuestion!.x + answerQuestion!.width);
  expect(answerOption!.y).toBeGreaterThan(answerQuestion!.y);
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

test("a 24-question design workflow keeps extra bottom-wheel scrolling inside its container", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await register(page);
  const survey = await createSurvey(
    page,
    false,
    Array.from({ length: 24 }, (_, index) => ({
      title: `滚动所有权回归问题 ${index + 1}`,
      type: index % 2 === 0 ? "single" : "short_text",
      required: index < 2,
      options: index % 2 === 0 ? ["选项 A", "选项 B"] : [],
    }))
  );

  await page.goto(`/surveys?survey=${survey.id}&step=design`);
  const workflowScrollContainer = page.getByTestId("survey-workflow-scroll-container");
  await expect(page.getByTestId("question-title-23")).toBeAttached({ timeout: 20_000 });

  const metrics = await workflowScrollContainer.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
  });
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  expect(metrics.scrollTop).toBeGreaterThan(0);

  const workflowBox = await workflowScrollContainer.boundingBox();
  expect(workflowBox).not.toBeNull();
  await page.mouse.move(workflowBox!.x + workflowBox!.width / 2, workflowBox!.y + workflowBox!.height / 2);
  await page.mouse.wheel(0, 4_000);
  await page.waitForTimeout(100);

  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
  expect(await page.getByTestId("app-scroll-container").evaluate((node) => node.scrollTop)).toBe(0);
});
