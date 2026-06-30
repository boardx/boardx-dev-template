import { test, expect } from "@playwright/test";

const uniq = () => `sv_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("已登录访问 /surveys 显示列表与空状态", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await expect(page.getByRole("heading", { name: "Surveys" })).toBeVisible();
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("创建问卷后出现在列表", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("empty-new-survey").click();

  await page.getByTestId("survey-title").fill("Team Pulse Survey");
  await page.getByTestId("survey-desc").fill("Quick weekly check-in");
  await page.getByTestId("survey-scope").selectOption("team");
  await page.getByTestId("question-title-0").fill("How are you feeling this week?");

  // 增加一道题再删除，验证题目增删可用
  await page.getByTestId("add-question").click();
  await page.getByTestId("question-title-1").fill("Anything blocking you?");
  await page.getByTestId("question-delete-1").click();

  await page.getByTestId("save-survey").click();

  await expect(page.getByTestId("survey-list")).toContainText("Team Pulse Survey");
  await expect(page.getByTestId("survey-list")).toContainText("Team");
});

test("空标题被拒，问卷不保存", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/surveys", { data: { title: "   " } });
  expect(res.status()).toBe(400);
});

test("未登录访问 /surveys 跳转登录", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/surveys");
  await expect(page).toHaveURL(/\/login/);
});
