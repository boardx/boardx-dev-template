import { test, expect } from "@playwright/test";

// uc-admin-002 — 后台团队管理（F03）：搜索/分页/编辑团队类型 + 手动上分。
// 覆盖：非 SysAdmin/未登录无法访问；SysAdmin 可搜索团队、查看基础信息（名称/类型/成员数/Credit）、
// 编辑团队类型（立即反映）、手动增加 Credit（立即反映）。手动上分复用 p14 credit_transactions。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndPromote(page: import("@playwright/test").Page) {
  const email = uniq("adm2");
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sys", lastName: "Admin", email, password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/dev/grant-sysadmin", { data: { email } });
  expect(res.status()).toBe(200);
  return email;
}

async function createTeam(page: import("@playwright/test").Page, name: string) {
  const res = await page.request.post("/api/teams", { data: { name } });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.team.id as number;
}

test("未登录访问 /admin/teams 跳转到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin/teams");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

test("已登录但非 SysAdmin 访问 /admin/teams 看到无权限", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain", lastName: "User", email: uniq("adm2np"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/admin/teams");
  await expect(page.getByTestId("admin-forbidden")).toBeVisible();
});

test("未登录调用团队列表 API 返回 401，非 SysAdmin 返回 403", async ({ page }) => {
  await page.context().clearCookies();
  const res401 = await page.request.get("/api/admin/teams");
  expect(res401.status()).toBe(401);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain2", lastName: "User", email: uniq("adm2np2"), password: "secret123", agreeTerms: true },
  });
  const res403 = await page.request.get("/api/admin/teams");
  expect(res403.status()).toBe(403);
});

test("SysAdmin 看到团队列表（名称/类型/成员数/Credit）并能搜索", async ({ page }) => {
  await registerAndPromote(page);
  const teamName = `Acme Search ${Date.now()}`;
  await createTeam(page, teamName);

  await page.goto("/admin/teams");
  await expect(page.getByTestId("team-list")).toBeVisible();
  await expect(page.getByTestId("team-list")).toContainText(teamName);

  // 搜索过滤：搜一个不存在的名字 → 空态
  await page.getByTestId("search").fill(`__no_such_team_${Date.now()}__`);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("empty")).toBeVisible();

  // 重置 → 恢复列表
  await page.getByTestId("reset-btn").click();
  await expect(page.getByTestId("team-list")).toContainText(teamName);

  // 搜索命中该团队
  await page.getByTestId("search").fill(teamName);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("team-list")).toContainText(teamName);
});

test("SysAdmin 编辑团队类型，立即反映", async ({ page }) => {
  await registerAndPromote(page);
  const teamName = `Acme TypeEdit ${Date.now()}`;
  const teamId = await createTeam(page, teamName);

  await page.goto("/admin/teams");
  await page.getByTestId("search").fill(teamName);
  await page.getByTestId("search-btn").click();

  await expect(page.getByTestId(`team-type-${teamId}`)).toContainText("Standard");

  await page.getByTestId(`edit-team-${teamId}`).click();
  await expect(page.getByTestId("edit-team-modal")).toBeVisible();
  await page.getByTestId("edit-team-type").selectOption("enterprise");
  await page.getByTestId("save-team-type").click();

  await expect(page.getByTestId("edit-team-modal")).toHaveCount(0);
  await expect(page.getByTestId(`team-type-${teamId}`)).toContainText("Enterprise");

  // 越权直接调 API 也应校验非法取值
  const badRes = await page.request.patch(`/api/admin/teams/${teamId}`, { data: { teamType: "nonsense" } });
  expect(badRes.status()).toBe(400);
});

test("SysAdmin 为团队手动增加 Credit，余额立即反映", async ({ page }) => {
  await registerAndPromote(page);
  const teamName = `Acme Credit ${Date.now()}`;
  const teamId = await createTeam(page, teamName);

  await page.goto("/admin/teams");
  await page.getByTestId("search").fill(teamName);
  await page.getByTestId("search-btn").click();

  await expect(page.getByTestId(`team-credit-${teamId}`)).toContainText("0");

  await page.getByTestId(`grant-credit-${teamId}`).click();
  await expect(page.getByTestId("manual-credit-modal")).toBeVisible();
  await page.getByTestId("credit-amount").fill("1500");
  await page.getByTestId("credit-note").fill("补偿");
  await page.getByTestId("save-credit").click();

  await expect(page.getByTestId("manual-credit-modal")).toHaveCount(0);
  await expect(page.getByTestId(`team-credit-${teamId}`)).toContainText("1,500");

  // 非法额度被拒
  const badRes = await page.request.post(`/api/admin/teams/${teamId}/credit`, { data: { amount: -5 } });
  expect(badRes.status()).toBe(400);
});
