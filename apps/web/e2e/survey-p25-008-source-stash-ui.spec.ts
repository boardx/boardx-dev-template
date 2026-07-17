import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const email = `p25_f08_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
  const response = await page.request.post("/api/auth/register", {
    data: { firstName: "Survey", lastName: "F08", email, password: "secret123", agreeTerms: true },
  });
  expect(response.status()).toBe(201);
}

async function seedSurveyList(page: Page) {
  const surveys: Array<{ id: number; questionId: number }> = [];
  for (const [index, title] of [
    "智能制造集团 · AI 转型成熟度诊断",
    "未来学校 · 学习体验诊断",
    "组织变革工作坊 · 前期调研",
  ].entries()) {
    const response = await page.request.post("/api/surveys", {
      data: {
        title,
        description: index === 0 ? "面向管理者与骨干员工的工作坊前诊断。" : "用于工作坊前收集结构化反馈。",
        questions: [
          {
            title: index === 0 ? "你认为当前最需要改善的环节是什么？" : "你对当前体验的整体评价如何？",
            type: index === 0 ? "text" : "rating",
            required: true,
            options: [],
            category: index === 0 ? "战略共识" : "体验反馈",
          },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const survey = (await response.json()).survey as { id: number; questions: Array<{ id: number }> };
    surveys.push({ id: survey.id, questionId: survey.questions[0]!.id });
    const activated = await page.request.patch(`/api/surveys/${survey.id}`, {
      data: { isActive: true },
    });
    expect(activated.status()).toBe(200);
  }
  return surveys;
}

test("BoardX Survey home matches the diagnostic workspace reference", async ({ page }) => {
  await register(page);
  const surveys = await seedSurveyList(page);
  await page.goto("/surveys");

  await expect(page.getByTestId("survey-diagnostic-home")).toBeVisible();
  await expect(page.getByTestId("survey-source-sidebar")).toContainText("BoardX Survey");
  const navigation = page.getByRole("navigation", { name: "Survey navigation" });
  await expect(navigation).toContainText("主页");
  await expect(navigation).toContainText("洞察报告");
  await expect(navigation.locator("button")).toHaveCount(5);
  await expect(navigation.locator("button svg")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: /下午好|上午好|晚上好/ })).toContainText("Survey");
  await expect(page.getByTestId("survey-home-context")).toBeVisible();
  await expect(page.getByTestId("survey-home-metrics")).toBeVisible();
  const reportMetric = page.getByTestId("survey-home-metrics").getByText("生成报告").locator("..");
  await expect(reportMetric).toContainText("0");
  await expect(page.getByTestId("survey-home-organization")).toBeVisible();
  await expect(page.getByTestId("survey-home-community")).toBeVisible();
  await expect(page.getByTestId("survey-home-method")).toBeVisible();
  await expect(page.getByTestId("survey-home-templates")).toBeVisible();
  await expect(page.getByTestId("survey-home-recent")).toBeVisible();
  await expect(page.getByTestId("ai-survey-command-center")).toHaveCount(0);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-home-desktop.png",
    fullPage: true,
  });
  await page.getByTestId("survey-home-method").getByRole("button", { name: "查看问卷" }).click();
  await expect(page).toHaveURL(/\/surveys\?view=my/);

  for (const answer of ["第一份反馈", "第二份反馈"]) {
    const submitted = await page.request.post(`/api/surveys/${surveys[0]!.id}/responses`, {
      data: { answers: { [surveys[0]!.questionId]: answer } },
    });
    expect(submitted.status()).toBe(201);
  }
  for (let index = 0; index < 2; index += 1) {
    const generated = await page.request.post(`/api/surveys/${surveys[0]!.id}/ai-report`, {
      data: { model: "mock-survey-quality" },
    });
    expect(generated.status()).toBe(200);
  }
  const listed = await page.request.get("/api/surveys");
  expect(listed.status()).toBe(200);
  const listedPayload = await listed.json() as {
    surveys: Array<{ id: number; responses: number; generatedReports: number }>;
  };
  const firstSurvey = listedPayload.surveys.find((survey) => survey.id === surveys[0]!.id);
  expect(firstSurvey?.responses).toBe(2);
  expect(firstSurvey?.generatedReports).toBe(2);

  await page.goto("/surveys");
  await expect(reportMetric).toContainText("2");
});

test("my surveys exposes all three reference creation paths", async ({ page }) => {
  await register(page);
  await seedSurveyList(page);
  await page.goto("/surveys?view=my");

  await expect(page.getByTestId("survey-list-screen")).toBeVisible();
  await expect(page.getByTestId("create-path-ai")).toBeVisible();
  await expect(page.getByTestId("create-path-template")).toBeVisible();
  await expect(page.getByTestId("create-path-blank")).toBeVisible();
  await expect(page.getByLabel("正在加载问卷")).toHaveCount(0);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-my-surveys-desktop.png",
  });
});

test("home recommendation starts a survey from the selected template", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");

  await page.locator('[data-testid^="survey-home-template-"]').first().click();
  await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
  await expect(page.getByTestId("template-editor-shell")).toHaveCount(0);
  await page.getByTestId("survey-editor-reference-header").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-unified-editor-viewport.png",
  });
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
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
});

test("new survey chooser uses three columns on desktop and one column on mobile", async ({ page }) => {
  await register(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();

  const chooser = page.getByTestId("new-survey-dialog");
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

  await expect(page.getByTestId("survey-editor-reference-header")).toBeVisible();
  await expect(page.getByTestId("survey-editor-stepper")).toBeVisible();
  await expect(page.getByTestId("editor-command-bar")).toHaveCount(1);
  await expect(page.locator('[data-testid^="workflow-"]')).toHaveCount(5);
  await expect(page.getByRole("button", { name: "预览", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "报告模版", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "发布问卷", exact: true })).toBeVisible();

  const workspace = page.getByTestId("survey-editor-workspace");
  await expect(workspace).toBeVisible();
  await expect(workspace.getByTestId("survey-diagnostic-summary")).toBeVisible();
  await expect(workspace.getByTestId("survey-diagnostic-dimensions")).toBeVisible();
  await expect(workspace.getByTestId("survey-hypotheses")).toBeVisible();
  await expect(workspace.getByTestId("survey-question-canvas")).toBeVisible();
  await expect(workspace.getByTestId("survey-ai-assistant")).toBeVisible();

  await expect(workspace.getByRole("region", { name: "诊断摘要" })).toBeVisible();
  await expect(workspace.getByRole("region", { name: "诊断假设" })).toBeVisible();

  await page.getByTestId("add-question").click();
  const questionCanvas = workspace.getByTestId("survey-question-canvas");
  const questionList = questionCanvas.getByTestId("question-list");
  const firstQuestion = questionList.getByTestId("question-0");
  const secondQuestion = questionList.getByTestId("question-1");
  await expect(questionCanvas.getByRole("region", { name: "问题 1" })).toBeVisible();
  await expect(questionCanvas.getByRole("region", { name: "问题 2" })).toBeVisible();

  const canvasBox = await questionCanvas.boundingBox();
  const assistantBox = await workspace.getByTestId("survey-ai-assistant").boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(assistantBox!.x).toBeGreaterThan(canvasBox!.x);

  await page.getByTestId("survey-editor-reference-header").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-unified-editor-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(workspace).toBeVisible();
  await page.getByTestId("survey-editor-reference-header").scrollIntoViewIfNeeded();
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
  await expect(page.getByRole("heading", { name: "诊断模版中心" })).toBeVisible();
  await expect(page.getByTestId("template-tag-filter")).toBeVisible();

  const templateGrid = page.getByTestId("diagnostic-template-grid");
  const templateCards = templateGrid.locator("[data-testid^=template-card-]");
  await expect(templateCards).not.toHaveCount(0);
  const firstTwoCards = await Promise.all([templateCards.nth(0).boundingBox(), templateCards.nth(1).boundingBox()]);
  expect(firstTwoCards.every((box) => box)).toBe(true);
  expect(firstTwoCards[0]!.x).toBeLessThan(firstTwoCards[1]!.x);
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

test("template center separates AI generation, manual creation, and tag management", async ({ page }) => {
  await register(page);
  await page.goto("/surveys?view=templates");

  await expect(page.getByTestId("template-create-ai")).toBeVisible();
  await expect(page.getByTestId("template-create-manual")).toBeVisible();
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-template-center-desktop.png",
    fullPage: true,
  });
  await page.getByTestId("template-manage-tags").click();
  await expect(page.getByTestId("template-tag-manager-dialog")).toBeVisible();

  await page.goto("/surveys?view=templates");
  await page.getByTestId("template-create-ai").click();
  await expect(page.getByTestId("template-editor-shell")).toBeVisible();
  await expect(page.getByTestId("template-ai-assistant")).toBeVisible();

  await page.goto("/surveys?view=templates");
  await page.getByTestId("template-create-manual").click();
  await expect(page.getByTestId("template-editor-shell")).toBeVisible();
  await expect(page.getByTestId("template-ai-assistant")).toHaveCount(0);
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

test("sidebar insight report opens the selected survey report", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "洞察报告入口问卷",
      questions: [{ title: "你最关注哪个问题？", type: "text", required: true, options: [] }],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  await page.goto("/surveys");
  await expect(page.getByTestId("survey-home-recent")).toContainText("洞察报告入口问卷");
  await page.getByTestId("survey-nav-insights").click();
  await expect(page).toHaveURL(new RegExp(`/surveys/${survey.id}/results`));
  await expect(page.getByTestId("survey-insight-report")).toBeVisible();
});
