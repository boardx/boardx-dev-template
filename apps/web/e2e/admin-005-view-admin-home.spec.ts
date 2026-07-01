import { test, expect } from "@playwright/test";

// uc-admin-005 — Admin Panel 首页：身份门控 + 统计摘要 + 模块导航（F01，Admin 骨架地基）。
// 覆盖：未登录跳转登录；已登录非 SysAdmin 见 403；SysAdmin 见统计摘要 + 模块导航，
// 可点导航进入对应管理页（含尚未建成的占位子页）。

const uniq = () => `adm5_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndPromote(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sys", lastName: "Admin", email, password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/dev/grant-sysadmin", { data: { email } });
  expect(res.status()).toBe(200);
  return email;
}

test("未登录访问 /admin 跳转到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

test("已登录但非 SysAdmin 访问 /admin 看到 403 无权限", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/admin");
  await expect(page.getByTestId("admin-forbidden")).toBeVisible();
  await expect(page.getByTestId("admin-forbidden")).toContainText("无权限访问");
});

test("SysAdmin 访问 /admin 看到统计摘要与模块导航", async ({ page }) => {
  await registerAndPromote(page);
  await page.goto("/admin");

  // 无 403 面板
  await expect(page.getByTestId("admin-forbidden")).toHaveCount(0);

  // 统计摘要：加载骨架 → 真实卡片（用户/团队为真实聚合，AI Store 为占位）
  await expect(page.getByTestId("admin-stats")).toBeVisible();
  await expect(page.getByTestId("stat-用户总数")).toBeVisible();
  await expect(page.getByTestId("stat-团队总数")).toBeVisible();
  await expect(page.getByTestId("stat-AI Store 项目数")).toBeVisible();
  await expect(page.getByTestId("stat-mock-AI Store 项目数")).toBeVisible();

  // 模块导航：四个模块卡片都可见
  await expect(page.getByTestId("admin-module-nav")).toBeVisible();
  await expect(page.getByTestId("module-users")).toBeVisible();
  await expect(page.getByTestId("module-teams")).toBeVisible();
  await expect(page.getByTestId("module-ai-store-review")).toBeVisible();
  await expect(page.getByTestId("module-ai-store-featured")).toBeVisible();

  // 尚未建成模块（AI Store 审核/精选，各自独立 feature）标注"即将上线"；
  // 团队管理（F03）已落地，不带该徽章——见 admin-002-manage-teams.spec.ts。
  await expect(page.getByTestId("module-badge-ai-store-review")).toBeVisible();
  await expect(page.getByTestId("module-badge-ai-store-featured")).toBeVisible();
  await expect(page.getByTestId("module-badge-teams")).toHaveCount(0);
});

test("SysAdmin 点用户管理导航进入 /admin/users", async ({ page }) => {
  await registerAndPromote(page);
  await page.goto("/admin");
  await page.getByTestId("module-users").click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(page.getByTestId("user-list")).toBeVisible();
});

test("SysAdmin 点团队管理导航进入 /admin/teams", async ({ page }) => {
  await registerAndPromote(page);
  await page.goto("/admin");
  await page.getByTestId("module-teams").click();
  await expect(page).toHaveURL(/\/admin\/teams$/);
  await expect(page.getByTestId("team-list")).toBeVisible();
});

test("统计摘要 API 未登录 401、非 SysAdmin 403", async ({ page }) => {
  await page.context().clearCookies();
  const res401 = await page.request.get("/api/admin/stats");
  expect(res401.status()).toBe(401);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain2", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res403 = await page.request.get("/api/admin/stats");
  expect(res403.status()).toBe(403);
});
