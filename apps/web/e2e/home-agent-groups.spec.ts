import { test, expect } from "@playwright/test";

const uniq = () => `hag_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("三个 Agent 分组无数据时显示空状态 + 进入AI Store/创建Agent 入口", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/home");

  for (const key of ["recent", "subscribed", "recommended"]) {
    await expect(page.getByTestId(`empty-${key}`)).toBeVisible();
    await expect(page.getByTestId(`enter-store-${key}`)).toBeVisible();
    await expect(page.getByTestId(`create-agent-${key}`)).toBeVisible();
  }
});

test("点「进入 AI Store」入口跳转 /ai-store", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/home");
  await page.getByTestId("enter-store-recent").click();
  await expect(page).toHaveURL(/\/ai-store/);
});
