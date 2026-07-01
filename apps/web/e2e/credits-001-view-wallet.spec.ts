import { test, expect, type APIRequestContext } from "@playwright/test";

// uc-credits-001-view-wallet —— 完成契约。
// 覆盖：
// - 普通用户（无团队/member）登录后 /credits 展示个人钱包余额 + 摘要卡片 + Usage/Purchase 流水表；
//   用户菜单个人 Credit 余额入口可见且展示数值。
// - Team 管理角色（owner/admin）进入 /credits 展示团队钱包（GET /api/credits/wallet?scope=team）。
// - 无权限（member）请求团队钱包 → 403，看不到团队钱包。
// - 空态：`state=empty` 展示空钱包 + 空态提示。
// - 加载骨架、未登录跳转。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any, base: string): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(base), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("登录后 /credits 展示个人钱包余额 + 标题 + Buy credits", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/credits");

  await expect(page.getByTestId("credits-title")).toHaveText("Credits");
  await expect(page.getByTestId("buy-credits")).toBeVisible();

  // 摘要卡片 + 当前余额（首次访问按确定性样例流水播种：8000 授予 + 5500 购买 - 400 - 1200 消耗 = 11,900）。
  await expect(page.getByTestId("wallet-summary")).toBeVisible();
  await expect(page.getByTestId("balance")).toContainText("11,900");
  await expect(page.getByTestId("wallet-summary")).toContainText("Current balance");
  // 个人视角不展示团队名 scope 标签
  await expect(page.getByTestId("scope-label")).toHaveCount(0);
});

test("登录后 /credits 默认 Usage 标签展示消耗记录列表，切 Purchase 展示购买记录", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/credits");

  await expect(page.getByTestId("records")).toBeVisible();
  await expect(page.getByTestId("empty")).toHaveCount(0);

  await page.getByTestId("tab-purchase").click();
  await expect(page.getByTestId("records")).toBeVisible();
  await expect(page.getByTestId("empty")).toHaveCount(0);
});

test("无记录时 /credits?state=empty 展示空状态", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/credits?state=empty");

  await expect(page.getByTestId("balance")).toContainText("Current balance");
  await expect(page.getByTestId("balance")).toContainText("0");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("records")).toHaveCount(0);
});

test("用户菜单展示个人 Credit 余额入口与数值", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "L", email: uniq("cr"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await expect(page.getByTestId("user-menu-credits")).toBeVisible();
  await expect(page.getByTestId("user-menu-credits-balance")).toContainText("credits");
});

test("Team owner 进入 /credits 展示团队钱包（scope=team）+ 团队名", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Own", lastName: "Er", email: uniq("crt"), password: "secret123", agreeTerms: true },
  });
  const team = await (await page.request.post("/api/teams", { data: { name: "Credits Co" } })).json();
  expect(team.team?.id).toBeTruthy();

  await page.goto("/credits");
  await expect(page.getByTestId("credits-title")).toHaveText("Credits");
  await expect(page.getByTestId("scope-label")).toHaveText("Credits Co");
  await expect(page.getByTestId("wallet-summary")).toBeVisible();
  await expect(page.getByTestId("balance")).toContainText("11,900");

  // API 直接校验 scope=team 返回团队维度数据
  const res = await page.request.get("/api/credits/wallet?scope=team");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.wallet.scope).toBe("team");
  expect(body.wallet.balance).toBe(11900);
});

test("Team member（非 owner/admin）请求团队钱包 → 403，看不到团队钱包", async ({ playwright }) => {
  const owner = await newUser(playwright, "crm-own");
  const team = await (await owner.post("/api/teams", { data: { name: "Member Co" } })).json();
  const invite = await (await owner.post(`/api/teams/${team.team.id}/invites`, { data: {} })).json();

  const member = await newUser(playwright, "crm-mem");
  const join = await member.post("/api/teams/join", { data: { token: invite.token } });
  expect(join.status()).toBe(200);
  const joinBody = await join.json();
  expect(joinBody.role).toBe("member");

  // member 切换当前团队到该团队，再请求 team scope 钱包 → 403
  await member.post("/api/teams/current", { data: { teamId: team.team.id } });
  const res = await member.get("/api/credits/wallet?scope=team");
  expect(res.status()).toBe(403);

  await owner.dispose();
  await member.dispose();
});

test("未登录访问 /credits → 跳登录", async ({ page }) => {
  await page.goto("/credits");
  await expect(page).toHaveURL(/\/login/);
});

test("未登录调用 /api/credits/wallet → 401", async ({ page }) => {
  const res = await page.request.get("/api/credits/wallet");
  expect(res.status()).toBe(401);
});

test("未登录调用兼容旧路径 /api/credits → 401", async ({ page }) => {
  const res = await page.request.get("/api/credits");
  expect(res.status()).toBe(401);
});
