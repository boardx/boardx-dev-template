import { test, expect } from "@playwright/test";

const uniq = () => `hs_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("已登录访问 /home：欢迎区显示用户名与团队名 + 搜索框 + 三个 Agent 分组", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "Lovelace", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.request.post("/api/teams", { data: { name: "Acme" } });

  await page.goto("/home");
  await expect(page.getByTestId("home-username")).toBeVisible();
  await expect(page.getByTestId("home-team")).toHaveText("Acme");
  await expect(page.getByTestId("agent-search")).toBeVisible();
  await expect(page.getByTestId("group-recent")).toBeVisible();
  await expect(page.getByTestId("group-subscribed")).toBeVisible();
  await expect(page.getByTestId("group-recommended")).toBeVisible();
});

test("未登录访问 /home → 跳转登录", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});
