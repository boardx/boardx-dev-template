import { test, expect } from "@playwright/test";

const uniq = () => `adm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ad", lastName: "Min", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("未登录访问 /admin/users 跳转到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin/users");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

test("管理员看到用户列表并能创建用户", async ({ page }) => {
  await register(page);
  await page.goto("/admin/users");

  // 列表渲染（样例用户）
  await expect(page.getByTestId("user-list")).toBeVisible();
  await expect(page.getByTestId("user-list")).toContainText("alex@boardx.io");

  // 创建用户 → 出现在列表
  const email = uniq();
  await page.getByTestId("show-create").click();
  await page.getByTestId("new-name").fill("New Person");
  await page.getByTestId("new-email").fill(email);
  await page.getByTestId("create").click();

  await expect(page.getByTestId("user-list")).toContainText(email);
});

test("创建邮箱格式无效被拒（400）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/admin/users", {
    data: { name: "Bad", email: "not-an-email", role: "user" },
  });
  expect(res.status()).toBe(400);
});

test("未登录调用列表 API 返回 401", async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.request.get("/api/admin/users");
  expect(res.status()).toBe(401);
});
