import { test, expect } from "@playwright/test";

// uc-admin-001 — 后台用户管理（F02）：列表/搜索/分页/增删改 + 手动上分。
// 覆盖：非 SysAdmin/未登录无法访问；SysAdmin 可搜索用户、创建/编辑/删除用户、手动增加个人 Credit（立即反映）。
// 手动上分复用 p14 credit_transactions（personal scope），与 F03 团队上分同一套仓储函数。
//
// 注意：注册接口（POST /api/auth/register）会 startSession 写入会话 cookie。测试里已用
// page 登录为 SysAdmin 后，若还要在同一测试里再注册一个"目标用户"，必须走独立的
// playwright.request.newContext()（不共享 page 的 cookie jar），否则 page.request.post
// 会把 SysAdmin 的会话 cookie 覆盖成新注册用户的会话，导致后续 page.reload()/page.goto()
// 以非管理员身份访问，命中 403 而非预期的列表页（其它 e2e spec，如 board-create.spec.ts，
// 同样用 newContext 隔离多用户）。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndPromote(page: import("@playwright/test").Page) {
  const email = uniq("adm1");
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sys", lastName: "Admin", email, password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/dev/grant-sysadmin", { data: { email } });
  expect(res.status()).toBe(200);
  return email;
}

/** 用独立 request context 注册一个"目标用户"，不影响 page 当前的会话 cookie。 */
async function registerIsolated(
  playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  firstName: string,
  lastName: string,
  email: string,
) {
  const ctx = await playwright.request.newContext({ baseURL });
  const res = await ctx.post("/api/auth/register", {
    data: { firstName, lastName, email, password: "secret123", agreeTerms: true },
  });
  await ctx.dispose();
  return res;
}

test("未登录访问 /admin/users 跳转到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin/users");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

test("已登录但非 SysAdmin 访问 /admin/users 看到无权限", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain", lastName: "User", email: uniq("adm1np"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/admin/users");
  await expect(page.getByTestId("admin-forbidden")).toBeVisible();
});

test("未登录调用用户列表 API 返回 401，非 SysAdmin 返回 403", async ({ page }) => {
  await page.context().clearCookies();
  const res401 = await page.request.get("/api/admin/users");
  expect(res401.status()).toBe(401);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain2", lastName: "User", email: uniq("adm1np2"), password: "secret123", agreeTerms: true },
  });
  const res403 = await page.request.get("/api/admin/users");
  expect(res403.status()).toBe(403);
});

test("SysAdmin 看到用户列表并能搜索", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const email = uniq("adm1search");

  await page.goto("/admin/users");
  await expect(page.getByTestId("user-list")).toBeVisible();

  await registerIsolated(playwright, baseURL!, "Search", "Target", email);
  await page.reload();
  await expect(page.getByTestId("user-list")).toContainText(email);

  // 搜索过滤：搜一个不存在的邮箱 → 空态
  await page.getByTestId("search").fill(`__no_such_user_${Date.now()}__`);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("empty")).toBeVisible();

  // 重置 → 恢复列表
  await page.getByTestId("reset-btn").click();
  await expect(page.getByTestId("user-list")).toContainText(email);

  // 搜索命中该用户
  await page.getByTestId("search").fill(email);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("user-list")).toContainText(email);
});

test("SysAdmin 创建用户，立即出现在列表", async ({ page }) => {
  await registerAndPromote(page);
  await page.goto("/admin/users");

  const email = uniq("adm1create");
  await page.getByTestId("show-create").click();
  await page.getByTestId("new-first-name").fill("New");
  await page.getByTestId("new-last-name").fill("Person");
  await page.getByTestId("new-email").fill(email);
  await page.getByTestId("create").click();

  await expect(page.getByTestId("user-list")).toContainText(email);

  // 创建邮箱格式无效被拒（400）
  const badRes = await page.request.post("/api/admin/users", {
    data: { firstName: "Bad", lastName: "Email", email: "not-an-email" },
  });
  expect(badRes.status()).toBe(400);
});

test("SysAdmin 编辑用户资料，立即反映", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const email = uniq("adm1edit");
  await registerIsolated(playwright, baseURL!, "Before", "Edit", email);

  await page.goto("/admin/users");
  await page.getByTestId("search").fill(email);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("user-list")).toContainText("Before Edit");

  const meRes = await page.request.get("/api/admin/users?q=" + encodeURIComponent(email));
  const body = await meRes.json();
  const userId = body.users[0].id as number;

  await page.getByTestId(`edit-${userId}`).click();
  await expect(page.getByTestId("edit-user-modal")).toBeVisible();
  await page.getByTestId("edit-first-name").fill("After");
  await page.getByTestId("edit-role").selectOption("sysadmin");
  await page.getByTestId("save-user").click();

  await expect(page.getByTestId("edit-user-modal")).toHaveCount(0);
  await expect(page.getByTestId("user-list")).toContainText("After Edit");

  // 越权直接调 API 也应校验非法取值
  const badRes = await page.request.patch(`/api/admin/users/${userId}`, { data: { platformRole: "nonsense" } });
  expect(badRes.status()).toBe(400);
});

test("SysAdmin 删除用户（确认弹窗），立即从列表移除", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const email = uniq("adm1delete");
  await registerIsolated(playwright, baseURL!, "To", "Delete", email);

  await page.goto("/admin/users");
  await page.getByTestId("search").fill(email);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("user-list")).toContainText(email);

  const meRes = await page.request.get("/api/admin/users?q=" + encodeURIComponent(email));
  const body = await meRes.json();
  const userId = body.users[0].id as number;

  await page.getByTestId(`delete-${userId}`).click();
  await expect(page.getByTestId("delete-user-modal")).toBeVisible();
  await page.getByTestId("confirm-delete-user").click();

  await expect(page.getByTestId("delete-user-modal")).toHaveCount(0);
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("SysAdmin 为用户手动增加 Credit，余额立即反映", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const email = uniq("adm1credit");
  await registerIsolated(playwright, baseURL!, "Credit", "Target", email);

  await page.goto("/admin/users");
  await page.getByTestId("search").fill(email);
  await page.getByTestId("search-btn").click();

  const meRes = await page.request.get("/api/admin/users?q=" + encodeURIComponent(email));
  const body = await meRes.json();
  const userId = body.users[0].id as number;
  const creditCell = page.getByTestId(`user-credit-${userId}`);
  await expect(creditCell).toContainText("0");

  await page.getByTestId(`grant-credit-${userId}`).click();
  await expect(page.getByTestId("manual-credit-modal")).toBeVisible();
  await page.getByTestId("credit-amount").fill("1500");
  await page.getByTestId("credit-note").fill("补偿");
  await page.getByTestId("save-credit").click();

  await expect(page.getByTestId("manual-credit-modal")).toHaveCount(0);
  await expect(creditCell).toContainText("1,500");

  // 非法额度被拒
  const badRes = await page.request.post(`/api/admin/users/${userId}/credit`, { data: { amount: -5 } });
  expect(badRes.status()).toBe(400);
});

test("用户手动上分带幂等 key：重复提交（同 key）不会重复入账", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const email = uniq("adm1idem");
  const regRes = await registerIsolated(playwright, baseURL!, "Idem", "Target", email);
  expect(regRes.status()).toBe(201);

  const meRes = await page.request.get("/api/admin/users?q=" + encodeURIComponent(email));
  const body = await meRes.json();
  const userId = body.users[0].id as number;

  const idemKey = `idem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const headers = { "content-type": "application/json", "idempotency-key": idemKey };

  const res1 = await page.request.post(`/api/admin/users/${userId}/credit`, {
    headers,
    data: { amount: 1000 },
  });
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  expect(body1.wallet.balance).toBe(1000);

  // 同一 idempotency key 重放（模拟双击/网络重试）→ 不应二次入账
  const res2 = await page.request.post(`/api/admin/users/${userId}/credit`, {
    headers,
    data: { amount: 1000 },
  });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  expect(body2.wallet.balance).toBe(1000); // 仍是 1000，不是 2000
  expect(body2.idempotent).toBe(true);

  // 换一个新 key 再提交 → 视为新的一次上分，正常入账
  const res3 = await page.request.post(`/api/admin/users/${userId}/credit`, {
    headers: { "content-type": "application/json", "idempotency-key": `${idemKey}-v2` },
    data: { amount: 1000 },
  });
  expect(res3.status()).toBe(200);
  const body3 = await res3.json();
  expect(body3.wallet.balance).toBe(2000);
});
