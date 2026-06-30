import { test, expect } from "@playwright/test";

// uc-profile-003-manage-user-menu — 侧边栏用户菜单
// 行为：打开个人菜单 → 身份头 + 各账号入口可见；Profile 进 /account；退出登录清会话回 signin。

const uniq = () => `um_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "L", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("打开用户菜单：身份头 + 全部账号入口可见", async ({ page }) => {
  await register(page);
  await page.goto("/");

  // 菜单默认收起
  await expect(page.getByTestId("user-menu-popup")).toHaveCount(0);

  // 点击侧边栏账号头像触发器展开菜单
  await page.getByRole("button", { name: "账号菜单" }).click();
  await expect(page.getByTestId("user-menu-popup")).toBeVisible();

  // 身份头：姓名 + 邮箱
  await expect(page.getByTestId("user-menu-identity")).toBeVisible();
  await expect(page.getByTestId("user-menu-name")).toContainText("Ada L");
  await expect(page.getByTestId("user-menu-email")).toBeVisible();

  // 账号能力入口
  await expect(page.getByTestId("user-menu-credits")).toBeVisible();
  await expect(page.getByTestId("user-menu-profile")).toBeVisible();
  await expect(page.getByTestId("user-menu-team")).toBeVisible();
  await expect(page.getByTestId("user-menu-settings")).toBeVisible();
  await expect(page.getByTestId("user-menu-kb")).toBeVisible();
  await expect(page.getByTestId("user-menu-invite")).toBeVisible();

  // 语言 + 主题区
  await expect(page.getByTestId("user-menu-language")).toBeVisible();
  await expect(page.getByTestId("user-menu-theme")).toBeVisible();

  // 退出登录
  await expect(page.getByTestId("user-menu-logout")).toBeVisible();
});

test("点击 Profile 进入账号中心 /account", async ({ page }) => {
  await register(page);
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-profile").click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByTestId("section-personal")).toBeVisible();
});

test("点击 Settings 进入账号中心 Settings 分区", async ({ page }) => {
  await register(page);
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-settings").click();
  await expect(page).toHaveURL(/\/account\?section=settings/);
  await expect(page.getByTestId("section-settings")).toBeVisible();
});

test("退出登录清除会话并回到登录页", async ({ page }) => {
  await register(page);
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-logout").click();
  await expect(page).toHaveURL(/\/login/);

  // 会话已清除：再访问受保护页回登录
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});
