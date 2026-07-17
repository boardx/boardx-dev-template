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

  await expect(page.getByTestId("survey-source-sidebar")).toContainText("BoardX Survey");
  const navigation = page.getByRole("navigation", { name: "Survey navigation" });
  await expect(navigation).toContainText("主页");
  await expect(navigation.locator("button")).toHaveCount(4);
  await expect(navigation.locator("button svg")).toHaveCount(4);
  await expect(page.getByRole("heading", { name: /下午好|上午好|晚上好/ })).toBeVisible();
  await expect(page.getByTestId("survey-home-metrics")).toBeVisible();
  await expect(page.getByText("组织", { exact: true })).toHaveCount(0);
  await expect(page.getByText("顾问社区", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("survey-home-method")).toContainText("为什么在工作坊之前用 Survey");
  await expect(page.getByTestId("survey-home-templates")).toBeVisible();
  await expect(page.getByTestId("survey-home-recent")).toBeVisible();
  await expect(page.getByTestId("ai-survey-command-center")).toHaveCount(0);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-reference-home.png",
    fullPage: true,
  });
});

test("home method cards navigate to real survey workflows", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");

  await page.getByTestId("survey-method-templates").click();
  await expect(page).toHaveURL(/\/surveys\?view=templates/);

  await page.goto("/surveys");
  await page.getByTestId("survey-method-create").click();
  await page.getByTestId("new-survey-ai").click();
  await expect(page.getByTestId("editor-command-bar")).toBeVisible();

  await page.goto("/surveys");
  await page.getByTestId("survey-method-report").click();
  await expect(page).toHaveURL(/\/surveys\?view=my/);
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
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("ai-assistant-panel")).toHaveCount(0);
});

test("diagnostic template center keeps template and report actions available", async ({ page }) => {
  await register(page);
  await page.goto("/surveys?view=templates");

  await expect(page).toHaveURL(/\/surveys\?view=templates/);
  await expect(page.getByTestId("survey-source-sidebar")).toBeVisible();
  await expect(page.getByTestId("diagnostic-template-center")).toBeVisible();
  await expect(page.getByRole("heading", { name: "诊断模板中心" })).toBeVisible();
  await expect(page.getByTestId("template-tag-filter")).toBeVisible();

  const templateGrid = page.getByTestId("diagnostic-template-grid");
  await expect(templateGrid).toHaveClass(/md:grid-cols-2/);
  const templateCards = templateGrid.locator("[data-testid^=template-card-]");
  await expect(templateCards).not.toHaveCount(0);
  await expect(templateCards.first()).toContainText("系统");

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
  await expect(page.getByTestId("template-editor-shell")).toBeVisible();
});
