import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const email = `p25_f08_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
  const response = await page.request.post("/api/auth/register", {
    data: { firstName: "Survey", lastName: "F08", email, password: "secret123", agreeTerms: true },
  });
  expect(response.status()).toBe(201);
}

test("BoardX Survey home matches the diagnostic workspace reference", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");

  await expect(page.getByTestId("survey-diagnostic-home")).toBeVisible();
  await expect(page.getByTestId("survey-source-sidebar")).toContainText("BoardX Survey");
  const navigation = page.getByRole("navigation", { name: "Survey navigation" });
  await expect(navigation).toContainText("主页");
  await expect(navigation.locator("button")).toHaveCount(4);
  await expect(navigation.locator("button svg")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: /下午好|上午好|晚上好/ })).toBeVisible();
  await expect(page.getByTestId("survey-home-context")).toBeVisible();
  await expect(page.getByTestId("survey-home-metrics")).toBeVisible();
  await expect(page.getByTestId("survey-home-organization")).toBeVisible();
  await expect(page.getByTestId("survey-home-community")).toBeVisible();
  await expect(page.getByTestId("survey-home-method")).toBeVisible();
  await expect(page.getByTestId("survey-home-templates")).toBeVisible();
  await expect(page.getByTestId("survey-home-recent")).toBeVisible();
  await expect(page.getByTestId("ai-survey-command-center")).toHaveCount(0);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-reference-home.png",
    fullPage: true,
  });
});

test("my surveys exposes all three reference creation paths", async ({ page }) => {
  await register(page);
  await page.goto("/surveys?view=my");

  await expect(page.getByTestId("survey-list-screen")).toBeVisible();
  await expect(page.getByTestId("create-path-ai")).toBeVisible();
  await expect(page.getByTestId("create-path-template")).toBeVisible();
  await expect(page.getByTestId("create-path-blank")).toBeVisible();
});

test("new survey chooser routes each creation path", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");

  await page.getByTestId("create-with-ai").click();
  await expect(page.getByTestId("new-survey-dialog")).toBeVisible();
  await expect(page.getByTestId("new-survey-ai")).toBeVisible();
  await expect(page.getByTestId("new-survey-template")).toBeVisible();
  await expect(page.getByTestId("new-survey-blank")).toBeVisible();

  await page.getByTestId("new-survey-template").click();
  await expect(page).toHaveURL(/\/surveys\?view=templates/);

  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-ai").click();
  await expect(page.getByTestId("editor-command-bar")).toBeVisible();

  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-blank").click();
  await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("ai-assistant-panel")).toHaveCount(0);
});

test("new survey chooser uses three columns on desktop and one column on mobile", async ({ page }) => {
  await register(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();

  const chooser = page.getByTestId("new-survey-dialog");
  await expect(chooser.locator(".grid").first()).toHaveClass(/md:grid-cols-3/);
  const desktopChoices = await Promise.all(["ai", "template", "blank"].map(async (kind) => page.getByTestId(`new-survey-${kind}`).boundingBox()));
  expect(desktopChoices.every((box) => box)).toBe(true);
  expect(desktopChoices[0]!.x).toBeLessThan(desktopChoices[1]!.x);
  expect(desktopChoices[1]!.x).toBeLessThan(desktopChoices[2]!.x);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileChoices = await Promise.all(["ai", "template", "blank"].map(async (kind) => page.getByTestId(`new-survey-${kind}`).boundingBox()));
  expect(mobileChoices.every((box) => box)).toBe(true);
  expect(mobileChoices[0]!.x).toBe(mobileChoices[1]!.x);
  expect(mobileChoices[1]!.x).toBe(mobileChoices[2]!.x);
  expect(mobileChoices[0]!.y).toBeLessThan(mobileChoices[1]!.y);
  expect(mobileChoices[1]!.y).toBeLessThan(mobileChoices[2]!.y);
});

test("unified survey editor keeps diagnostic structure and a subordinate AI assistant", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-blank").click();

  await expect(page.getByTestId("editor-command-bar")).toHaveCount(1);
  await expect(page.locator('[data-testid^="workflow-"]')).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Responses", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toHaveCount(0);

  const workspace = page.getByTestId("survey-editor-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace.getByTestId("survey-diagnostic-summary")).toBeVisible();
  await expect(workspace.getByTestId("survey-hypotheses")).toBeVisible();
  await expect(workspace.getByTestId("survey-question-canvas")).toBeVisible();

  await expect(workspace.getByRole("region", { name: "诊断摘要" })).toBeVisible();
  await expect(workspace.getByRole("region", { name: "诊断假设" })).toBeVisible();

  const summary = workspace.getByTestId("survey-diagnostic-summary");
  const hypotheses = workspace.getByTestId("survey-hypotheses");
  await expect(summary).toHaveCSS("box-shadow", "none");
  await expect(hypotheses).toHaveCSS("border-left-width", "0px");
  await expect(hypotheses).toHaveCSS("border-right-width", "0px");

  await page.getByTestId("add-question").click();
  const questionCanvas = workspace.getByTestId("survey-question-canvas");
  const questionList = questionCanvas.getByTestId("question-list");
  const firstQuestion = questionList.getByTestId("question-0");
  const secondQuestion = questionList.getByTestId("question-1");
  await expect(questionCanvas).toHaveCSS("box-shadow", "none");
  await expect(firstQuestion).toHaveCSS("box-shadow", "none");
  await expect(firstQuestion).toHaveCSS("border-top-width", "0px");
  await expect(secondQuestion).toHaveCSS("border-top-width", "1px");
  await expect(questionCanvas.getByRole("region", { name: "问题 1" })).toBeVisible();
  await expect(questionCanvas.getByRole("region", { name: "问题 2" })).toBeVisible();

  await page.getByTestId("open-ai-assistant").click();
  await expect(workspace.getByTestId("survey-ai-assistant")).toBeVisible();

  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-unified-editor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workspace).toBeVisible();
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-unified-editor-mobile.png",
    fullPage: true,
  });
});

test("diagnostic template center keeps template and report actions available", async ({ page }) => {
  await register(page);
  await page.route("**/api/survey-templates", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const templates = (payload.templates ?? []).map((template: Record<string, unknown>, index: number) => (
      index === 0 ? { ...template, category: undefined } : template
    ));
    await route.fulfill({ response, json: { ...payload, templates } });
  });
  await page.goto("/surveys?view=templates");

  await expect(page).toHaveURL(/\/surveys\?view=templates/);
  await expect(page.getByTestId("survey-source-sidebar")).toBeVisible();
  await expect(page.getByTestId("survey-template-center")).toBeVisible();
  await expect(page.getByTestId("diagnostic-template-center")).toBeVisible();
  await expect(page.getByRole("heading", { name: "诊断模板中心" })).toBeVisible();
  await expect(page.getByTestId("template-tag-filter")).toBeVisible();

  const templateGrid = page.getByTestId("diagnostic-template-grid");
  await expect(templateGrid).toHaveClass(/md:grid-cols-2/);
  const templateCards = templateGrid.locator("[data-testid^=template-card-]");
  await expect(templateCards).not.toHaveCount(0);
  await expect(templateCards.first()).toContainText("系统");
  const initialTemplateCount = await templateCards.count();

  const genericFilter = page.getByTestId("template-tag-filter").getByRole("button", { name: "通用", exact: true });
  await expect(genericFilter).toBeVisible();
  await genericFilter.click();
  await expect(templateCards).toHaveCount(1);
  await expect(templateCards.first().locator('[data-testid^="template-category-"]')).toHaveText("通用");

  await page.getByTestId("template-tag-filter").getByRole("button", { name: "全部", exact: true }).click();
  await expect(templateCards).toHaveCount(initialTemplateCount);
  await page.unroute("**/api/survey-templates");

  const firstTemplateId = await templateCards.first().getAttribute("data-testid");
  expect(firstTemplateId).toBeTruthy();
  const templateId = firstTemplateId!.replace("template-card-", "");
  await expect(page.getByTestId(`use-template-${templateId}`)).toBeVisible();
  await expect(page.getByTestId(`view-report-template-${templateId}`)).toBeVisible();
  await expect(page.getByText("Template Manager", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("template-summary")).toHaveCount(0);

  await page.getByTestId(`use-template-${templateId}`).click();
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();

  await page.goto("/surveys?view=templates");
  await page.getByTestId(`view-report-template-${templateId}`).click();
  await expect(page).toHaveURL(/\/surveys\?survey=\d+&step=template/);
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  await expect(page.getByTestId("template-editor-shell")).toHaveCount(0);
});

test("sidebar report templates opens a selected survey's report template workflow", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "报告模板入口问卷",
      questions: [{ title: "目前最需要解决的问题是什么？", type: "text", required: true, options: [] }],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  await page.goto("/surveys");
  await expect(page.getByTestId("survey-home-recent")).toContainText("报告模板入口问卷");
  await page.getByTestId("survey-nav-reports").click();
  await expect(page).toHaveURL(new RegExp(`/surveys\\?survey=${survey.id}&step=template`));
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  await expect(page.getByTestId("template-editor-shell")).toHaveCount(0);
});
