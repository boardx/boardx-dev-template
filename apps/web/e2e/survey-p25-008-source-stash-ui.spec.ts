import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const email = `p25_f08_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
  const response = await page.request.post("/api/auth/register", {
    data: { firstName: "Survey", lastName: "F08", email, password: "secret123", agreeTerms: true },
  });
  expect(response.status()).toBe(201);
}

test("BoardX Survey workspace matches the source stash navigation", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");

  await expect(page.getByTestId("survey-source-sidebar")).toContainText("BoardX Survey");
  await expect(page.getByRole("navigation", { name: "Survey navigation" })).toContainText("Home Page");
  await expect(page.getByRole("heading", { name: "我的问卷" })).toBeVisible();
  await expect(page.getByTestId("ai-survey-command-center")).toHaveCount(0);
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
