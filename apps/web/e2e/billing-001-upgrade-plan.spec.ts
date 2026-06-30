import { test, expect } from "@playwright/test";

const uniq = () => `bl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("已登录访问 /billing：展示当前计划 + 可升级计划 + 升级 CTA", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "Lovelace", email: uniq(), password: "secret123", agreeTerms: true },
  });

  await page.goto("/billing");

  // 当前计划区可见（默认 free）
  await expect(page.getByTestId("current-plan")).toBeVisible();
  await expect(page.getByTestId("current-plan")).toContainText("Free");

  // 计划列表 + 升级 CTA 可见
  await expect(page.getByTestId("plan-list")).toBeVisible();
  await expect(page.getByTestId("plan-pro")).toBeVisible();
  await expect(page.getByTestId("upgrade-pro")).toBeVisible();
  await expect(page.getByTestId("upgrade-pro")).toContainText("Upgrade");
});

test("未登录访问 /billing → 跳转登录", async ({ page }) => {
  await page.goto("/billing");
  await expect(page).toHaveURL(/\/login/);
});

test("API：未登录 GET /api/billing 返回 401", async ({ page }) => {
  const res = await page.request.get("/api/billing");
  expect(res.status()).toBe(401);
});
