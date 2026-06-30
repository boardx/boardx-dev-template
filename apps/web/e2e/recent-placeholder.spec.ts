import { test, expect } from "@playwright/test";

const uniq = () => `rp_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("/recent 显示 Recent Activity + 开发中占位", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/recent");
  await expect(page.getByTestId("recent-title")).toHaveText("Recent Activity");
  await expect(page.getByTestId("under-dev")).toContainText("under development");
});

test("未登录访问 /recent → 跳登录", async ({ page }) => {
  await page.goto("/recent");
  await expect(page).toHaveURL(/\/login/);
});
