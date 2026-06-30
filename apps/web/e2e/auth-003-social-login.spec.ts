import { test, expect } from "@playwright/test";

// uc-auth-003-social-login —— 第三方登录（stub）端到端验证。
// 入口 /(auth)/* → 点击 provider → POST /api/auth/social 建立会话 → 回首页已登录。

const GOOGLE_DEMO = "google.demo@social.boardx.local";
const WECHAT_DEMO = "wechat.demo@social.boardx.local";
const FACEBOOK_DEMO = "facebook.demo@social.boardx.local";

test("登录页点击 Google → 已登录回到首页", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("social-google").click();
  // 成功出口：用户处于已登录状态。
  await expect(page.getByTestId("current-user")).toContainText(GOOGLE_DEMO);
});

test("登录页点击 WeChat → 已登录回到首页", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("social-wechat").click();
  await expect(page.getByTestId("current-user")).toContainText(WECHAT_DEMO);
});

test("注册页点击 Facebook → 已登录回到首页", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/register");
  await page.getByTestId("social-facebook").click();
  await expect(page.getByTestId("current-user")).toContainText(FACEBOOK_DEMO);
});

test("第三方登出后回到访客态", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("social-google").click();
  await expect(page.getByTestId("current-user")).toBeVisible();
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("guest")).toBeVisible();
});

test("同一 provider 二次登录复用同一用户记录（不报错）", async ({ page }) => {
  // 第一次：建用户。
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("social-google").click();
  await expect(page.getByTestId("current-user")).toContainText(GOOGLE_DEMO);
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("guest")).toBeVisible();
  // 第二次：复用同一邮箱用户，仍能登录成功。
  await page.goto("/login");
  await page.getByTestId("social-google").click();
  await expect(page.getByTestId("current-user")).toContainText(GOOGLE_DEMO);
});

test("未启用 provider → 失败保持未登录", async ({ page, request }) => {
  await page.context().clearCookies();
  // 直接打 API 验证失败出口：未知 provider 返回非 2xx，不建立会话。
  const res = await request.post("/api/auth/social", { data: { provider: "myspace" } });
  expect(res.ok()).toBeFalsy();
  // 首页应为访客态。
  await page.goto("/");
  await expect(page.getByTestId("guest")).toBeVisible();
});
