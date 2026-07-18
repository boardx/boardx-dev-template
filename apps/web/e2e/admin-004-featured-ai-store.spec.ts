import { test, expect } from "@playwright/test";

// uc-admin-004 — AI Store 官方精选页（F05）：SysAdmin 查看已通过平台审核（APPROVED）的项目，
// 切换其官方精选状态（isFeatured）。复用 F04 审核页的资源管理布局（星标切换替代批准/拒绝按钮）。
// 覆盖：非 SysAdmin/未登录无法访问精选页与 API；精选页只展示 APPROVED 项目（PENDING 不出现，
// 拒绝/撤回后也不出现）；SysAdmin 可设为精选/取消精选，即时反映在卡片星标；精选 Tab 筛选；
// 幂等（重复提交同一目标值不报错）；对非 approved 项目切换返回 409（不允许绕过 F04 状态机）。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndPromote(page: import("@playwright/test").Page) {
  const email = uniq("adm4");
  await page.request.post("/api/auth/register", {
    data: { firstName: "Sys", lastName: "Admin", email, password: "secret123", agreeTerms: true },
  });
  expect((await page.request.post("/api/teams", { data: { name: `Admin Team ${Date.now()}` } })).status()).toBe(201);
  const res = await page.request.post("/api/dev/grant-sysadmin", { data: { email } });
  expect(res.status()).toBe(200);
  return email;
}

/** 用独立 request context 创建一个平台项目并提交审核，不污染 page 当前的会话 cookie。 */
async function createPendingItem(
  playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  name: string,
) {
  const ctx = await playwright.request.newContext({ baseURL });
  const email = uniq("creator4");
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

/** 创建一个已批准（APPROVED）的平台项目：先提交审核，再用 sysadmin session 走 F04 approve。 */
async function createApprovedItem(
  page: import("@playwright/test").Page,
  playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"],
  baseURL: string,
  name: string,
) {
  const item = await createPendingItem(playwright, baseURL, name);
  const res = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "approve" } });
  expect(res.status()).toBe(200);
  return item;
}

test("未登录访问 /admin/ai-store/featured 跳转到 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/admin/ai-store/featured");
  await page.waitForURL("**/login");
  expect(page.url()).toContain("/login");
});

test("已登录但非 SysAdmin 访问精选页看到无权限", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain", lastName: "User", email: uniq("adm4np"), password: "secret123", agreeTerms: true },
  });
  await page.goto("/admin/ai-store/featured");
  await expect(page.getByTestId("admin-forbidden")).toBeVisible();
});

test("未登录调用精选列表/切换 API 返回 401，非 SysAdmin 返回 403", async ({ page }) => {
  await page.context().clearCookies();
  const res401 = await page.request.get("/api/admin/ai-store/featured");
  expect(res401.status()).toBe(401);

  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain2", lastName: "User", email: uniq("adm4np2"), password: "secret123", agreeTerms: true },
  });
  const res403 = await page.request.get("/api/admin/ai-store/featured");
  expect(res403.status()).toBe(403);

  const toggleRes403 = await page.request.post("/api/admin/ai-store/1/featured", { data: { featured: true } });
  expect(toggleRes403.status()).toBe(403);
});

test("SysAdmin 看到已批准项目并能设为精选，状态立即反映在星标", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createApprovedItem(page, playwright, baseURL!, `Featured Toggle ${Date.now()}`);

  await page.goto("/admin/ai-store/featured");
  await expect(page.getByTestId("featured-list")).toBeVisible();
  await expect(page.getByTestId(`featured-item-${item.id}`)).toBeVisible();
  await expect(page.getByTestId(`featured-badge-${item.id}`)).toHaveCount(0);

  await page.getByTestId(`toggle-featured-${item.id}`).click();
  await expect(page.getByTestId(`featured-badge-${item.id}`)).toBeVisible();
  await expect(page.getByTestId(`toggle-featured-${item.id}`)).toContainText("Unfeature");
});

test("SysAdmin 可取消已精选项目的精选状态", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createApprovedItem(page, playwright, baseURL!, `Featured Untoggle ${Date.now()}`);

  const setRes = await page.request.post(`/api/admin/ai-store/${item.id}/featured`, { data: { featured: true } });
  expect(setRes.status()).toBe(200);

  await page.goto("/admin/ai-store/featured");
  await page.getByTestId("search").fill(item.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`featured-badge-${item.id}`)).toBeVisible();

  await page.getByTestId(`toggle-featured-${item.id}`).click();
  await expect(page.getByTestId(`featured-badge-${item.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`toggle-featured-${item.id}`)).toContainText("Set as featured");
});

test("精选页只展示 APPROVED 项目：PENDING 项目不出现，拒绝后的项目也不出现", async ({
  page,
  playwright,
  baseURL,
}) => {
  await registerAndPromote(page);
  const pendingItem = await createPendingItem(playwright, baseURL!, `Featured Pending ${Date.now()}`);

  const rejectedSeed = await createPendingItem(playwright, baseURL!, `Featured Rejected ${Date.now()}`);
  const rejectRes = await page.request.post(`/api/admin/ai-store/${rejectedSeed.id}/review`, {
    data: { action: "reject" },
  });
  expect(rejectRes.status()).toBe(200);

  await page.goto("/admin/ai-store/featured");
  await page.getByTestId("search").fill(pendingItem.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`featured-item-${pendingItem.id}`)).toHaveCount(0);

  await page.getByTestId("reset-btn").click();
  await page.getByTestId("search").fill(rejectedSeed.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`featured-item-${rejectedSeed.id}`)).toHaveCount(0);
});

test("精选 Tab 筛选：切到已精选只看到 featured=true 的项目", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createApprovedItem(page, playwright, baseURL!, `Featured Tab ${Date.now()}`);

  await page.goto("/admin/ai-store/featured");
  await page.getByTestId("featured-tab-true").click();
  await expect(page.getByTestId(`featured-item-${item.id}`)).toHaveCount(0);

  await page.getByTestId("featured-tab-false").click();
  await page.getByTestId("search").fill(item.name);
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`featured-item-${item.id}`)).toBeVisible();
});

test("精选切换幂等：重复提交同一目标值不报错；对未批准/已撤回项目切换返回 409", async ({
  page,
  playwright,
  baseURL,
}) => {
  await registerAndPromote(page);
  const item = await createApprovedItem(page, playwright, baseURL!, `Featured Idem ${Date.now()}`);

  const res1 = await page.request.post(`/api/admin/ai-store/${item.id}/featured`, { data: { featured: true } });
  expect(res1.status()).toBe(200);
  const body1 = await res1.json();
  expect(body1.item.featured).toBe(true);
  expect(body1.idempotent).toBe(false);

  // 重放同一个已经生效的目标值 → 幂等，不报错，仍是 true
  const res2 = await page.request.post(`/api/admin/ai-store/${item.id}/featured`, { data: { featured: true } });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json();
  expect(body2.item.featured).toBe(true);
  expect(body2.idempotent).toBe(true);

  // 非法 body → 400
  const res3 = await page.request.post(`/api/admin/ai-store/${item.id}/featured`, { data: { featured: "yes" } });
  expect(res3.status()).toBe(400);

  // 撤回到 PENDING 后，精选/取消精选不再对其生效（不允许绕过 F04 状态机）→ 409
  const revokeRes = await page.request.post(`/api/admin/ai-store/${item.id}/review`, { data: { action: "revoke" } });
  expect(revokeRes.status()).toBe(200);
  const res4 = await page.request.post(`/api/admin/ai-store/${item.id}/featured`, { data: { featured: false } });
  expect(res4.status()).toBe(409);

  // 不存在的 id → 409
  const res5 = await page.request.post(`/api/admin/ai-store/999999999/featured`, { data: { featured: true } });
  expect(res5.status()).toBe(409);
});

test("非 SysAdmin 无法通过 API 直接切换精选（越权防护）", async ({ page, playwright, baseURL }) => {
  await registerAndPromote(page);
  const item = await createApprovedItem(page, playwright, baseURL!, `Featured Priv ${Date.now()}`);
  await page.context().clearCookies();

  await page.request.post("/api/auth/register", {
    data: { firstName: "Plain2", lastName: "User", email: uniq("adm4np3"), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post(`/api/admin/ai-store/${item.id}/featured`, { data: { featured: true } });
  expect(res.status()).toBe(403);
});

// 精选对 Explore 的下游效果（uc-admin-004 user_visible_behavior："精选项目在 AI Store Explore
// 获得精选标/优先展示"）：F04 批准（→APPROVED）即视为"发布到平台"，APPROVED 的平台项目本就该在
// Explore 可见；精选（isFeatured=true）在此基础上额外获得 FEATURED 徽标，且排序优先于同批次的
// 非精选项目（packages/data/src/aiStore.ts 的 listAiStoreItems 用 ORDER BY featured DESC 排序）。
test("精选项目在 AI Store Explore 出现 FEATURED 徽标，且排序优先于未精选项目", async ({
  page,
  playwright,
  baseURL,
}) => {
  await registerAndPromote(page);
  const stamp = Date.now();
  const plainItem = await createApprovedItem(page, playwright, baseURL!, `Explore ${stamp} Plain`);
  const featuredItem = await createApprovedItem(page, playwright, baseURL!, `Explore ${stamp} Star`);

  // 批准（APPROVED）后、设为精选前：两者都应已经能在 Explore 里搜到（APPROVED = 发布到平台）。
  await page.goto("/ai-store");
  await page.getByTestId("store-search").fill(`Explore ${stamp}`);
  await page.getByTestId("store-search").press("Enter");
  await expect(page.getByTestId(`item-${plainItem.id}`)).toBeVisible();
  await expect(page.getByTestId(`item-${featuredItem.id}`)).toBeVisible();
  await expect(page.getByTestId(`item-featured-badge-${featuredItem.id}`)).toHaveCount(0);

  const setFeaturedRes = await page.request.post(`/api/admin/ai-store/${featuredItem.id}/featured`, {
    data: { featured: true },
  });
  expect(setFeaturedRes.status()).toBe(200);

  await page.goto("/ai-store");
  await page.getByTestId("store-search").fill(`Explore ${stamp}`);
  await page.getByTestId("store-search").press("Enter");

  // FEATURED 徽标只出现在被精选的项目卡片上。
  await expect(page.getByTestId(`item-featured-badge-${featuredItem.id}`)).toBeVisible();
  await expect(page.getByTestId(`item-featured-badge-${plainItem.id}`)).toHaveCount(0);

  // 排序：精选项目优先于未精选项目（ORDER BY featured DESC）。
  const grid = page.getByTestId("item-grid");
  const gridText = (await grid.textContent()) ?? "";
  const featuredPos = gridText.indexOf(featuredItem.name);
  const plainPos = gridText.indexOf(plainItem.name);
  expect(featuredPos).toBeGreaterThanOrEqual(0);
  expect(plainPos).toBeGreaterThanOrEqual(0);
  expect(featuredPos).toBeLessThan(plainPos);

  // 详情弹窗同样展示精选徽标。
  await page.getByTestId(`item-${featuredItem.id}`).click();
  await expect(page.getByTestId("detail-featured-badge")).toBeVisible();
});
