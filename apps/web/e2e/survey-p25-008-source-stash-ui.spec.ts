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
  await expect(page.getByRole("navigation", { name: "Survey navigation" })).toContainText("主页");
  await expect(page.getByRole("heading", { name: /下午好|上午好|晚上好/ })).toBeVisible();
  await expect(page.getByTestId("survey-home-metrics")).toBeVisible();
  await expect(page.getByTestId("survey-home-method")).toContainText("为什么在工作坊之前用 Survey");
  await expect(page.getByTestId("survey-home-templates")).toBeVisible();
  await expect(page.getByTestId("survey-home-recent")).toBeVisible();
  await expect(page.getByTestId("ai-survey-command-center")).toHaveCount(0);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-reference-home.png",
    fullPage: true,
  });
});

test("template URL restores the source stash template manager", async ({ page }) => {
  await register(page);
  await page.goto("/surveys?view=templates");

  await expect(page).toHaveURL(/\/surveys\?view=templates/);
  await expect(page.getByRole("heading", { name: "问卷模版" })).toBeVisible();
  await expect(page.getByTestId("templates-workbench")).toContainText("Template Manager");
  await expect(page.getByTestId("template-summary")).toContainText("全部模版");
  await expect(page.getByTestId("template-categories")).toBeVisible();
  await expect(page.getByTestId("templates-workbench").getByText("系统").first()).toBeVisible();
});
