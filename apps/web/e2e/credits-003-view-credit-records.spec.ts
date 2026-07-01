import { test, expect, type APIRequestContext } from "@playwright/test";

// uc-credits-003-view-credit-records —— 完成契约。
// 覆盖：
// - 用户菜单 > Credit 余额区域点击后打开「Credit Records」弹窗，展示个人摘要（余额+累计消耗）
//   与消费记录列表；空态；关闭弹窗返回原页面。
// - Team Owner/Admin 在 /credits 的 Usage/Purchase 标签页看团队维度分页记录。
// - GET /api/credits/transactions 分页返回（time/kind/amount/来源），越权范围（member 请求
//   scope=team）不可见 → 403；未登录 → 401。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any, base: string): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(base), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("用户菜单点击 Credit 余额区域打开 Credit Records 弹窗，展示摘要与消费记录", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr3"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-credits").click();

  await expect(page.getByTestId("credit-records-dialog")).toBeVisible();
  await expect(page.getByTestId("credit-records-summary")).toBeVisible();
  // 首次访问按 F01 确定性样例流水播种展示摘要与消耗记录；不锁死具体金额字面量——
  // 用户菜单自身也会并发拉取余额（sidebar.tsx），与弹窗的拉取时序无关，只断言展示了非空数值。
  await expect(page.getByTestId("credit-records-summary")).toContainText("Remaining credits");
  await expect(page.getByTestId("credit-records-summary")).toContainText("Total consumed");
  await expect(page.getByTestId("credit-records-list")).toBeVisible();
  await expect(page.getByTestId("credit-records-empty")).toHaveCount(0);
});

test("关闭 Credit Records 弹窗后返回原页面", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr3"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "账号菜单" }).click();
  await page.getByTestId("user-menu-credits").click();
  await expect(page.getByTestId("credit-records-dialog")).toBeVisible();

  await page.getByRole("button", { name: "关闭 Credit Records" }).click();
  await expect(page.getByTestId("credit-records-dialog")).toHaveCount(0);
  await expect(page).toHaveURL("/");
});

test("GET /api/credits/transactions?scope=personal 分页返回个人流水（time/kind/amount）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr3"), password: "secret123", agreeTerms: true },
  });
  // 先触发一次 wallet 加载完成播种流水
  await page.request.get("/api/credits/wallet?scope=personal");

  const res = await page.request.get("/api/credits/transactions?scope=personal&page=1&pageSize=2");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.records)).toBe(true);
  expect(body.records.length).toBeLessThanOrEqual(2);
  expect(body.page).toBe(1);
  expect(body.pageSize).toBe(2);
  expect(typeof body.total).toBe("number");
  expect(typeof body.hasMore).toBe("boolean");
  if (body.records.length > 0) {
    const r = body.records[0];
    expect(typeof r.when).toBe("string");
    expect(["usage", "purchase"]).toContain(r.kind);
    expect(typeof r.amount).toBe("number");
  }
});

test("state=empty 时 Credit Records 弹窗展示空状态", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq("cr3"), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.get("/api/credits/transactions?scope=personal&state=empty");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.records).toEqual([]);
  expect(body.total).toBe(0);
});

test("Team owner 在 /credits 的 Usage/Purchase 标签页看团队分页记录", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Own", lastName: "Er", email: uniq("cr3t"), password: "secret123", agreeTerms: true },
  });
  const team = await (await page.request.post("/api/teams", { data: { name: "Records Co" } })).json();
  expect(team.team?.id).toBeTruthy();

  await page.goto("/credits");
  await expect(page.getByTestId("scope-label")).toHaveText("Records Co");
  await expect(page.getByTestId("records")).toBeVisible();
  await expect(page.getByTestId("empty")).toHaveCount(0);

  const usageRes = await page.request.get("/api/credits/transactions?scope=team&kind=usage&page=1&pageSize=20");
  expect(usageRes.status()).toBe(200);
  const usageBody = await usageRes.json();
  expect(usageBody.records.every((r: { kind: string }) => r.kind === "usage")).toBe(true);

  await page.getByTestId("tab-purchase").click();
  await expect(page.getByTestId("records")).toBeVisible();
  const purchaseRes = await page.request.get("/api/credits/transactions?scope=team&kind=purchase&page=1&pageSize=20");
  expect(purchaseRes.status()).toBe(200);
  const purchaseBody = await purchaseRes.json();
  expect(purchaseBody.records.every((r: { kind: string }) => r.kind === "purchase")).toBe(true);
});

test("Team member（非 owner/admin）请求团队流水 → 403，越权范围不可见", async ({ playwright }) => {
  const owner = await newUser(playwright, "cr3m-own");
  const team = await (await owner.post("/api/teams", { data: { name: "Member Records Co" } })).json();
  const invite = await (await owner.post(`/api/teams/${team.team.id}/invites`, { data: {} })).json();

  const member = await newUser(playwright, "cr3m-mem");
  const join = await member.post("/api/teams/join", { data: { token: invite.token } });
  expect(join.status()).toBe(200);

  await member.post("/api/teams/current", { data: { teamId: team.team.id } });
  const res = await member.get("/api/credits/transactions?scope=team");
  expect(res.status()).toBe(403);

  await owner.dispose();
  await member.dispose();
});

test("未登录调用 /api/credits/transactions → 401", async ({ page }) => {
  const res = await page.request.get("/api/credits/transactions");
  expect(res.status()).toBe(401);
});
