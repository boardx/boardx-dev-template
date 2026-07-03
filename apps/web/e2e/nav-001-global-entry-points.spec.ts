import { test, expect } from "@playwright/test";

// uc-nav-001 — 全局导航接线（p16-F01）：Ava / Surveys / Admin 入口。
//
// 背景：Ava（AI 对话）、Surveys（问卷）、Admin（后台）均已有多个 feature passing，功能
// 完全可用，但此前全站没有任何导航入口，真实用户只能手动敲 URL 才能到达（这些页面的
// e2e 此前也都是 page.goto() 直达，没人断言过入口本身）。本 spec 覆盖真实点击路径，
// 见 .harness/instructions/testing-standards.md 新增的"新增顶层页面必须验证能被导航到"一节。
//
// Admin 入口门控：只对 SysAdmin 渲染（不是禁用态，是完全不出现在 DOM 里）。SysAdmin 判定
// 复用服务端 lib/admin.ts requireSysAdmin 同一套 isSysAdmin(platform_role) 逻辑
//（lib/session.ts toPublicUser 透传给客户端渲染，不在前端重新实现鉴权）。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerPlainUser(page: import("@playwright/test").Page) {
  const email = uniq("nav1_plain");
  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain", lastName: "User", email, password: "secret123", agreeTerms: true },
  });
  return email;
}

async function registerAndPromote(page: import("@playwright/test").Page) {
  const email = uniq("nav1_admin");
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sys", lastName: "Admin", email, password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/dev/grant-sysadmin", { data: { email } });
  expect(res.status()).toBe(200);
  return email;
}

// 导航后的 toHaveURL 断言给一个比全局 expect.timeout(10s) 更宽松的窗口：dev 模式下
// 目标路由若是本次运行第一次被访问，Next.js 需要按需编译该页面（尤其 /ava 这种大文件），
// 在负载较高的机器上编译耗时可能超过 10s，属于 dev-server 特有的开销，不是真实用户会
// 遇到的延迟（生产构建是预编译的）。用显式 30s 超时吸收这个编译窗口。
const NAV_TIMEOUT = 30_000;

test("已登录用户从 sidebar 点击 Ava 入口，到达 /ava", async ({ page }) => {
  await registerPlainUser(page);
  await page.goto("/");
  await page.getByTestId("rail-nav-ava").click();
  await expect(page).toHaveURL(/\/ava/, { timeout: NAV_TIMEOUT });
});

test("已登录用户从 sidebar 点击 Surveys 入口，到达 /surveys", async ({ page }) => {
  await registerPlainUser(page);
  await page.goto("/");
  await page.getByTestId("rail-nav-surveys").click();
  await expect(page).toHaveURL(/\/surveys/, { timeout: NAV_TIMEOUT });
});

test("普通用户登录后，导航里看不到 Admin 入口", async ({ page }) => {
  await registerPlainUser(page);
  await page.goto("/");
  await expect(page.getByTestId("rail-nav-admin")).toHaveCount(0);
});

test("SysAdmin 用户登录后，能看到 Admin 入口并点击进入 /admin", async ({ page }) => {
  await registerAndPromote(page);
  await page.goto("/");
  await expect(page.getByTestId("rail-nav-admin")).toBeVisible();
  await page.getByTestId("rail-nav-admin").click();
  await expect(page).toHaveURL(/\/admin/, { timeout: NAV_TIMEOUT });
});
