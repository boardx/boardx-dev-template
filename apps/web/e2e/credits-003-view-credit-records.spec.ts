import { test, expect, type APIRequestContext } from "@playwright/test";

// uc-credits-003-view-credit-records —— 完成契约。
// 覆盖：
// - 个人用户从用户菜单打开 Credit Records 弹窗，看到时间/类型/金额/来源记录与分页信息。
// - Team owner 在 /credits 看到团队交易表；GET /api/credits/transactions?scope=team 分页返回。
// - Team member 不能读取 team scope transactions。
// - 空态与未登录 API 状态。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any, base: string): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(base), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("个人从用户菜单打开 Credit Records 弹窗并看到个人积分流水", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ada", lastName: "L", email: uniq("cr3"), password: "secret123", agreeTerms: true },
  });

  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-credits").click();

  await expect(page.getByTestId("credit-records-dialog")).toBeVisible();
  await expect(page.getByText("Credit Records")).toBeVisible();
  await expect(page.getByTestId("credit-records-balance")).toContainText("credits");
  await expect(page.getByTestId("credit-records-list")).toBeVisible();
  await expect(page.getByTestId("credit-records-list")).toContainText(/Usage|Purchase/);
  await expect(page.getByTestId("credit-records-list")).toContainText(/Image generation|WeChat Pay|Agent run/);
  await expect(page.getByTestId("credit-records-page")).toContainText("Page 1");

  await page.getByTestId("close-credit-records").click();
  await expect(page.getByTestId("credit-records-dialog")).toHaveCount(0);
});

test("Team owner 在 /credits 查看团队交易表并通过 transactions API 分页", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Own", lastName: "Er", email: uniq("cr3-owner"), password: "secret123", agreeTerms: true },
  });
  const team = await (await page.request.post("/api/teams", { data: { name: "Records Co" } })).json();
  expect(team.team?.id).toBeTruthy();

  await page.goto("/credits");
  await expect(page.getByTestId("scope-label")).toHaveText("Records Co");
  await expect(page.getByTestId("records")).toBeVisible();
  await expect(page.getByTestId("records")).toContainText("Usage");
  await expect(page.getByTestId("transaction-page")).toContainText("Page 1");

  const res = await page.request.get("/api/credits/transactions?scope=team&page=1&pageSize=2");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.records.scope).toBe("team");
  expect(body.records.page).toBe(1);
  expect(body.records.pageSize).toBe(2);
  expect(body.records.total).toBeGreaterThanOrEqual(4);
  expect(body.records.hasNext).toBe(true);
  expect(body.records.transactions).toHaveLength(2);
  expect(body.records.transactions[0]).toEqual(
    expect.objectContaining({
      type: expect.stringMatching(/Usage|Purchase/),
      source: expect.any(String),
      amount: expect.any(Number),
    })
  );
});

test("Team member 不能越权读取团队积分流水", async ({ playwright }) => {
  const owner = await newUser(playwright, "cr3-own");
  const team = await (await owner.post("/api/teams", { data: { name: "Private Records Co" } })).json();
  const invite = await (await owner.post(`/api/teams/${team.team.id}/invites`, { data: {} })).json();

  const member = await newUser(playwright, "cr3-member");
  const join = await member.post("/api/teams/join", { data: { token: invite.token } });
  expect(join.status()).toBe(200);

  await member.post("/api/teams/current", { data: { teamId: team.team.id } });
  const res = await member.get("/api/credits/transactions?scope=team");
  expect(res.status()).toBe(403);

  const personal = await member.get("/api/credits/transactions?scope=personal&page=1&pageSize=2");
  expect(personal.status()).toBe(200);
  const body = await personal.json();
  expect(body.records.scope).toBe("personal");

  await owner.dispose();
  await member.dispose();
});

test("空态和未登录 transactions API 状态可见", async ({ page }) => {
  const anonymous = await page.request.get("/api/credits/transactions");
  expect(anonymous.status()).toBe(401);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Empty", lastName: "User", email: uniq("cr3-empty"), password: "secret123", agreeTerms: true },
  });
  const empty = await page.request.get("/api/credits/transactions?scope=personal&state=empty");
  expect(empty.status()).toBe(200);
  const emptyBody = await empty.json();
  expect(emptyBody.records.transactions).toHaveLength(0);

  await page.goto("/credits?state=empty");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("transaction-page")).toContainText("0 records");
});
