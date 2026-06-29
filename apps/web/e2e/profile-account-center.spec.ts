import { test, expect } from "@playwright/test";

const uniq = () => `pac_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "L", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("账号中心三分区切换，默认 Personal info", async ({ page }) => {
  await register(page);
  await page.goto("/account");
  await expect(page.getByTestId("section-personal")).toBeVisible();
  await page.getByTestId("tab-settings").click();
  await expect(page.getByTestId("section-settings")).toBeVisible();
  await page.getByTestId("tab-security").click();
  await expect(page.getByTestId("section-security")).toBeVisible();
});

test("?section=settings 直达 Settings 分区", async ({ page }) => {
  await register(page);
  await page.goto("/account?section=settings");
  await expect(page.getByTestId("section-settings")).toBeVisible();
});

test("首页用户菜单显示名 + Profile/Settings/登出 入口", async ({ page }) => {
  await register(page);
  await page.goto("/");
  await expect(page.getByTestId("menu-displayname")).toContainText("Ada L");
  await expect(page.getByTestId("link-profile")).toBeVisible();
  await expect(page.getByTestId("link-settings")).toBeVisible();
  await expect(page.getByTestId("logout")).toBeVisible();
});

test("未登录访问 /account 跳登录", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});
