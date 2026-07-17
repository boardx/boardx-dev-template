import { test, expect } from "@playwright/test";

// uc-admin-003 — AI Store 平台审核页（F04）：SysAdmin 查看 PENDING/APPROVED 的平台资源，
// 批准（→APPROVED）、拒绝（→REJECTED）、撤回已批准项目到待审核（→PENDING）。
// 覆盖：非 SysAdmin/未登录无法访问后台审核页与 API；SysAdmin 可看到列表、按状态筛选/搜索、
// 批准/拒绝/撤回操作即时反映在列表；确认弹窗防误操作（取消不改变状态）；
// 审核状态转移幂等（重复提交同一操作不报错、不产生非预期的二次转移），
// 并发/前置状态不符时返回 409（不悄悄"假装成功"）。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndPromote(page: import("@playwright/test").Page) {
  const email = uniq("adm3");
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sys", lastName: "Admin", email, password: "secret123", agreeTerms: true },
  });
  expect((await page.request.post("/api/teams", { data: { name: `Admin Team ${Date.now()}` } })).status()).toBe(201);
  const res = await page.request.post("/api/dev/grant-sysadmin", { data: { email } });
  expect(res.status()).toBe(200);
  return email;
}

/** 用独立 request context 创建一个"提交平台审核"的 AI Store 项目，不污染 page 当前的会话 cookie。 */
async function createPendingItem(
  playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  name: string,
) {
  const ctx = await playwright.request.newContext({ baseURL });
  const email = uniq("creator");
  await ctx.post("/api/auth/register", {
    data: { firstName: "Creator", lastName: "User", email, password: "secret123", agreeTerms: true },
  });
  expect((await ctx.post("/api/teams", { data: { name: `Creator Team ${Date.now()}` } })).status()).toBe(201);
  const res = await ctx.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "platform",
      action: "submit_review",
      name,
      description: `${name} description`,
      config: "You are a helpful research agent.",
      tags: "research",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  await ctx.dispose();
  return body.item as { id: number; name: string; status: string };
}

test("未登录访问 /admin/ai-store/review 跳转到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin/ai-store/review");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

test("已登录但非 SysAdmin 访问审核页看到无权限", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain", lastName: "User", email: uniq("adm3np"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/admin/ai-store/review");
  await expect(page.getByTestId("admin-forbidden")).toBeVisible();
});

test("未登录调用审核列表/操作 API 返回 401，非 SysAdmin 返回 403", async ({ page }) => {
  await page.context().clearCookies();
  const res401 = await page.request.get("/api/admin/ai-store");
  expect(res401.status()).toBe(401);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain2", lastName: "User", email: uniq("adm3np2"), password: "secret123", agreeTerms: true },
  });
  const res403 = await page.request.get("/api/admin/ai-store");
  expect(res403.status()).toBe(403);

  const reviewRes403 = await page.request.post("/api/admin/ai-store/1/review", { data: { action: "approve" } });
  expect(reviewRes403.status()).toBe(403);
});

test("SysAdmin 看到 PENDING 项目并能批准，状态立即变为 APPROVED", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createPendingItem(playwright, baseURL!, `Review Approve ${Date.now()}`);

  await page.goto("/admin/ai-store/review");
  await expect(page.getByTestId("review-list")).toBeVisible();
  await expect(page.getByTestId(`review-item-${item.id}`)).toBeVisible();
  await expect(page.getByTestId(`review-status-${item.id}`)).toContainText("PENDING");

  await page.getByTestId(`approve-${item.id}`).click();
  await expect(page.getByTestId("confirm-review-modal")).toBeVisible();
  await expect(page.getByTestId("confirm-review-name")).toContainText(item.name);

  // 取消不改变状态
  await page.getByTestId("cancel-review").click();
  await expect(page.getByTestId("confirm-review-modal")).toHaveCount(0);
  await expect(page.getByTestId(`review-status-${item.id}`)).toContainText("PENDING");

  // 确认批准 → APPROVED，且按钮变为"撤回批准"
  await page.getByTestId(`approve-${item.id}`).click();
  await page.getByTestId("confirm-review").click();
  await expect(page.getByTestId("confirm-review-modal")).toHaveCount(0);
  await expect(page.getByTestId(`review-status-${item.id}`)).toContainText("APPROVED");
  await expect(page.getByTestId(`revoke-${item.id}`)).toBeVisible();
});

test("SysAdmin 可撤回已批准项目到 PENDING", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createPendingItem(playwright, baseURL!, `Review Revoke ${Date.now()}`);

  // 先用 API 直接批准，简化到只测撤回路径
  const approveRes = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "approve" } });
  expect(approveRes.status()).toBe(200);

  await page.goto("/admin/ai-store/review");
  await page.getByTestId("search").fill(item.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`review-status-${item.id}`)).toContainText("APPROVED");

  await page.getByTestId(`revoke-${item.id}`).click();
  await expect(page.getByTestId("confirm-review-modal")).toBeVisible();
  await page.getByTestId("confirm-review").click();
  await expect(page.getByTestId("confirm-review-modal")).toHaveCount(0);
  await expect(page.getByTestId(`review-status-${item.id}`)).toContainText("PENDING");
});

test("SysAdmin 可拒绝 PENDING 项目，拒绝后不再出现在待审核/已批准列表", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createPendingItem(playwright, baseURL!, `Review Reject ${Date.now()}`);

  await page.goto("/admin/ai-store/review");
  await page.getByTestId("search").fill(item.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`review-item-${item.id}`)).toBeVisible();

  await page.getByTestId(`reject-${item.id}`).click();
  await expect(page.getByTestId("confirm-review-modal")).toBeVisible();
  await page.getByTestId("confirm-review").click();
  await expect(page.getByTestId("confirm-review-modal")).toHaveCount(0);

  // 拒绝后不再落在 pending/approved 审核队列内
  await expect(page.getByTestId(`review-item-${item.id}`)).toHaveCount(0);
});

test("状态 Tab 筛选：切到已批准只看到 APPROVED 项目", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createPendingItem(playwright, baseURL!, `Review Tab ${Date.now()}`);

  await page.goto("/admin/ai-store/review");
  await page.getByTestId("status-tab-approved").click();
  await expect(page.getByTestId(`review-item-${item.id}`)).toHaveCount(0);

  await page.getByTestId("status-tab-pending").click();
  await page.getByTestId("search").fill(item.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`review-item-${item.id}`)).toBeVisible();
});

test("审核状态转移幂等：重复提交同一批准操作不报错、状态不变；前置状态不符返回 409", async ({
  page,
}) => {
  await registerAndPromote(page);

  const create = await page.request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "platform",
      action: "submit_review",
      name: `Review Idem ${Date.now()}`,
      description: "idempotency check",
      config: "instructions",
      tags: "research",
    },
  });
  expect(create.status()).toBe(201);
  const item = (await create.json()).item as { id: number };

  const res1 = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "approve" } });
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  expect(body1.item.status).toBe("approved");
  expect(body1.idempotent).toBe(false);

  // 重放同一个已经生效的操作 → 幂等，不报错，仍是 approved
  const res2 = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "approve" } });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  expect(body2.item.status).toBe("approved");
  expect(body2.idempotent).toBe(true);

  // 前置状态不符（已经是 approved，又想 reject——reject 只接受 pending 前置）→ 409
  const res3 = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "reject" } });
  expect(res3.status()).toBe(409);

  // 非法 action → 400
  const res4 = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "nonsense" } });
  expect(res4.status()).toBe(400);

  // 不存在的 id → 409（对调用方而言与竞态覆盖同样处理：刷新重试，不假装成功）
  const res5 = await page.request.post(`/api/admin/ai-store/999999999/review`, { data: { action: "approve" } });
  expect(res5.status()).toBe(409);
});
