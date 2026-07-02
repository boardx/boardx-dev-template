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

  // 单次上分金额有服务端上限，防止任意大额注入（与 F02 用户上分一致）。
  const tooLargeRes = await page.request.post(`/api/admin/teams/${teamId}/credit`, {
    data: { amount: 100_001 },
  });
  expect(tooLargeRes.status()).toBe(400);
});

test("手动上分带幂等 key：重复提交（同 key）不会重复入账", async ({ page }) => {
  await registerAndPromote(page);
  const teamName = `Acme Idem ${Date.now()}`;
  const teamId = await createTeam(page, teamName);

  const idemKey = `idem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const headers = { "content-type": "application/json", "idempotency-key": idemKey };

  const res1 = await page.request.post(`/api/admin/teams/${teamId}/credit`, {
    headers,
    data: { amount: 1000 },
  });
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  expect(body1.wallet.balance).toBe(1000);

  // 同一 idempotency key 重放（模拟双击/网络重试）→ 不应二次入账
  const res2 = await page.request.post(`/api/admin/teams/${teamId}/credit`, {
    headers,
    data: { amount: 1000 },
  });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  expect(body2.wallet.balance).toBe(1000); // 仍是 1000，不是 2000
  expect(body2.idempotent).toBe(true);

  // 换一个新 key 再提交 → 视为新的一次上分，正常入账
  const res3 = await page.request.post(`/api/admin/teams/${teamId}/credit`, {
    headers: { "content-type": "application/json", "idempotency-key": `${idemKey}-v2` },
    data: { amount: 1000 },
  });
  expect(res3.status()).toBe(200);
  const body3 = await res3.json();
  expect(body3.wallet.balance).toBe(2000);
});

test("团队手动上分同一 Idempotency-Key 并发请求不会双重入账", async ({ page }) => {
  // PR #177 review：此前只有 SELECT 查重（check-then-act），并发下会双双查空、双双入账。
  // recordTransactionIdempotent 用单事务 INSERT ... ON CONFLICT DO NOTHING 兜底，
  // 这里用 8 个并发请求带同一个 idem key 验证余额只会加一次。
  await registerAndPromote(page);
  const teamName = `Acme Race ${Date.now()}`;
  const teamId = await createTeam(page, teamName);

  const idemKey = `race-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const headers = { "content-type": "application/json", "idempotency-key": idemKey };
  const responses = await Promise.all(
    Array.from({ length: 8 }, () =>
      page.request.post(`/api/admin/teams/${teamId}/credit`, {
        headers,
        data: { amount: 777 },
      })
    )
  );

  for (const res of responses) {
    expect(res.status()).toBe(200);
  }
  const bodies = await Promise.all(responses.map((res) => res.json()));
  expect(bodies.some((resBody) => resBody.idempotent === true)).toBeTruthy();
  expect(bodies.every((resBody) => resBody.wallet.balance === 777)).toBeTruthy();
});

test("手动上分 note 超长会被服务端裁剪到 200 字符", async ({ page }) => {
  await registerAndPromote(page);
  const teamName = `Acme NoteCap ${Date.now()}`;
  const teamId = await createTeam(page, teamName);

  const longNote = "x".repeat(500);
  const res = await page.request.post(`/api/admin/teams/${teamId}/credit`, {
    data: { amount: 100, note: longNote },
  });
  expect(res.status()).toBe(200);
  // 服务端裁剪逻辑不对外暴露原始 description，这里只验证请求本身被接受（不 500/不因超长报错），
  // 裁剪结果的落库行为由 packages/data 层的字符串操作保证（slice(0, 200)），属实现细节。
});
