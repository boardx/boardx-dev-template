import { test, expect } from "@playwright/test";

// uc-survey-005-manage-templates — 问卷模板管理（应用 / 保存 / 删除团队模板）。

const uniq = () => `sv_tpl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "T", lastName: "P", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("创建问卷时可应用内置模板、保存团队模板、重新应用并删除", async ({ page }) => {
  await register(page);
  const team = (await (await page.request.post("/api/teams", { data: { name: "Template Team" } })).json()).team;

  await page.goto("/surveys");
  await page.getByTestId("empty-new-survey").click();

  await expect(page.getByTestId("survey-template-manager")).toBeVisible();
  await expect(page.getByTestId("template-blank")).toBeVisible();
  await expect(page.getByTestId("survey-team-templates-empty")).toBeVisible();

  await page.locator('[data-testid^="builtin-template-"]').first().click();
  await expect(page.getByTestId("template-message")).toContainText("applied");
  await expect(page.getByTestId("question-title-0")).not.toHaveValue("");

  await page.getByTestId("question-title-0").fill("Edited from template");
  await expect(page.getByTestId("question-title-0")).toHaveValue("Edited from template");

  await page.getByTestId("template-title").fill("Reusable pulse template");
  await page.getByTestId("template-team").selectOption(String(team.id));
  await page.getByTestId("save-template").click();
  await expect(page.getByTestId("template-message")).toContainText("Template saved");
  await expect(page.getByTestId("survey-team-templates")).toContainText("Reusable pulse template");

  await page.getByTestId("template-blank").click();
  await expect(page.getByTestId("question-title-0")).toHaveValue("");

  await page.locator('[data-testid^="team-template-"]').filter({ hasText: "Reusable pulse template" }).click();
  await expect(page.getByTestId("question-title-0")).toHaveValue("Edited from template");
  await page.getByTestId("question-title-0").fill("Editable after team template");
  await expect(page.getByTestId("question-title-0")).toHaveValue("Editable after team template");

  await page.locator('[data-testid^="delete-template-"]').first().click();
  await expect(page.getByTestId("template-message")).toContainText("Template deleted");
  await expect(page.getByTestId("survey-team-templates-empty")).toBeVisible();
});
