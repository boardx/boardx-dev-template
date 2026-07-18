import { test, expect } from "@playwright/test";

test.setTimeout(180_000);

// uc-ai-store-006：团队 AI Store 审核与精选。团队管理角色（owner）在团队审核视图查看
// PENDING 队列，通过确认弹窗批准/拒绝/撤回；对已批准（published）项目切换团队精选；
// 非管理角色（普通成员）看不到审核入口（服务端 403 + 客户端展示无权限态）。

const uniq = (tag: string) => `as6_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndLogin(page: import("@playwright/test").Page, email: string) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function createTeam(page: import("@playwright/test").Page, name: string) {
  const res = await page.request.post("/api/teams", { data: { name } });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.team.id as number;
}

async function switchTeam(page: import("@playwright/test").Page, teamId: number) {
  const res = await page.request.post("/api/teams/current", { data: { teamId } });
  expect(res.ok()).toBeTruthy();
}

// 通过真实 UI 创建一个 team-scope 项目并提交审核（action=submit_review, scope=team）。
async function submitTeamItemForReview(page: import("@playwright/test").Page, name: string) {
  await page.goto("/ai-store");
  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId("create-view")).toBeVisible();
  await page.getByTestId("field-name").fill(name);
  await page.getByTestId("field-description").fill("Team review test item.");
  await page.getByTestId("field-config").fill("Some config instructions for the team test agent.");
  await page.getByTestId("field-scope").selectOption("team");
  await page.getByTestId("action-submit-review").click();
  await expect(page.getByTestId("saved")).toContainText("已提交审核", { timeout: 30_000 });

  const card = page.getByTestId("owner-items").locator(`article:has-text("${name}")`);
  await expect(card).toBeVisible();
  const cardTestId = await card.getAttribute("data-testid");
  return Number(cardTestId!.replace("owner-item-", ""));
}

test("未登录访问团队审核 API 返回 401", async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.request.get("/api/teams/1/ai-store-review");
  expect(res.status()).toBe(401);
});

test("团队 owner 审核团队项目：提交审核后出现在待审队列，通过确认弹窗批准后发布并移出队列", async ({ page }) => {
  const ownerEmail = uniq("owner1");
  await registerAndLogin(page, ownerEmail);
  const teamName = `AS6 Team Approve ${Date.now()}`;
  const teamId = await createTeam(page, teamName);
  await switchTeam(page, teamId);

  const itemName = `AS6 Approve Item ${Date.now()}`;
  const itemId = await submitTeamItemForReview(page, itemName);

  // 团队审核视图入口只对管理角色（owner/admin）可见。
  await page.goto("/teams");
  await expect(page.getByTestId("ai-store-review-entry")).toBeVisible();
  await page.getByTestId("ai-store-review-link").click();
  await expect(page).toHaveURL(new RegExp(`/teams/${teamId}/ai-store-review`));

  await expect(page.getByTestId("team-ai-store-review-page")).toBeVisible();
  const reviewCard = page.getByTestId(`review-card-${itemId}`);
  await expect(reviewCard).toBeVisible();
  await expect(reviewCard).toContainText(itemName);
  await expect(page.getByTestId(`review-status-${itemId}`)).toHaveText("PENDING");

  // 点击通过 → 确认弹窗展示资源名称/描述 → 确认后才真正切换状态。
  await page.getByTestId(`approve-${itemId}`).click();
  const modal = page.getByTestId("confirm-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("confirm-item-name")).toContainText(itemName);
  await expect(modal.getByTestId("confirm-item-description")).toBeVisible();
  await modal.getByTestId("confirm-submit").click();

  await expect(page.getByTestId("action-message")).toContainText("已通过审核");
  // 已批准项目应从待审队列消失，出现在精选列表。
  await expect(page.getByTestId(`review-card-${itemId}`)).toHaveCount(0);
  await expect(page.getByTestId("review-empty")).toBeVisible();
  await expect(page.getByTestId(`featured-card-${itemId}`)).toBeVisible();

  // 服务端状态确实是 published：浏览列表应能看到该团队项目（团队可见范围）。
  const browseRes = await page.request.get("/api/ai-store/items");
  const browseData = await browseRes.json();
  const published = browseData.items.find(
    (it: { id: number | string }) => Number(it.id) === itemId,
  ) as { id: number; version: number; status: string } | undefined;
  expect(published?.status).toBe("published");

  // 已批准内容后续编辑立即生效，不重新进入审核。
  const editRes = await page.request.patch(`/api/ai-store/items/${itemId}`, {
    data: {
      type: "agent",
      scope: "team",
      action: "draft",
      expectedVersion: published!.version,
      name: itemName,
      description: "Published content updated without another review.",
      config: "Updated instructions after approval.",
    },
  });
  expect(editRes.ok()).toBeTruthy();
  const edited = (await editRes.json()).item as { status: string; description: string };
  expect(edited.status).toBe("published");
  expect(edited.description).toBe("Published content updated without another review.");
});

test("团队 owner 拒绝审核项目：拒绝后移出待审队列，不进入精选", async ({ page }) => {
  const ownerEmail = uniq("owner2");
  await registerAndLogin(page, ownerEmail);
  const teamName = `AS6 Team Reject ${Date.now()}`;
  const teamId = await createTeam(page, teamName);
  await switchTeam(page, teamId);

  const itemName = `AS6 Reject Item ${Date.now()}`;
  const itemId = await submitTeamItemForReview(page, itemName);

  await page.goto(`/teams/${teamId}/ai-store-review`);
  await expect(page.getByTestId(`review-card-${itemId}`)).toBeVisible();

  await page.getByTestId(`reject-${itemId}`).click();
  const modal = page.getByTestId("confirm-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("confirm-item-name")).toContainText(itemName);
  await modal.getByTestId("confirm-submit").click();

  await expect(page.getByTestId("action-message")).toContainText("已拒绝");
  await expect(page.getByTestId(`review-card-${itemId}`)).toHaveCount(0);
  await expect(page.getByTestId(`featured-card-${itemId}`)).toHaveCount(0);

  // 服务端确认状态为 rejected；同一 Team 的非法状态转换返回 409。
  const withdrawRes = await page.request.post(`/api/teams/${teamId}/ai-store-review/${itemId}`, {
    data: { action: "withdraw" },
  });
  expect(withdrawRes.status()).toBe(409);
});

test("团队 owner 切换精选状态，UI 立即反映；精选只对已批准项目生效", async ({ page }) => {
  const ownerEmail = uniq("owner3");
  await registerAndLogin(page, ownerEmail);
  const teamName = `AS6 Team Featured ${Date.now()}`;
  const teamId = await createTeam(page, teamName);
  await switchTeam(page, teamId);

  const itemName = `AS6 Featured Item ${Date.now()}`;
  const itemId = await submitTeamItemForReview(page, itemName);

  await page.goto(`/teams/${teamId}/ai-store-review`);
  await page.getByTestId(`approve-${itemId}`).click();
  await page.getByTestId("confirm-modal").getByTestId("confirm-submit").click();
  await expect(page.getByTestId("action-message")).toContainText("已通过审核");

  const featuredCard = page.getByTestId(`featured-card-${itemId}`);
  await expect(featuredCard).toBeVisible();
  await expect(featuredCard.getByTestId(`featured-badge-${itemId}`)).toHaveCount(0);

  // 设为精选：确认弹窗 → 确认 → featured 标识立即出现。
  await page.getByTestId(`toggle-featured-${itemId}`).click();
  const modal = page.getByTestId("confirm-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("confirm-item-name")).toContainText(itemName);
  await modal.getByTestId("confirm-submit").click();
  await expect(page.getByTestId("action-message")).toContainText("已设为团队精选");
  await expect(page.getByTestId(`featured-badge-${itemId}`)).toBeVisible();

  // 服务端确认 featured=true。
  const afterSetRes = await page.request.get(`/api/teams/${teamId}/ai-store-featured`);
  const afterSetData = await afterSetRes.json();
  expect(
    afterSetData.items.some(
      (it: { id: number | string; featured: boolean }) => Number(it.id) === itemId && it.featured === true
    )
  ).toBeTruthy();

  // 取消精选：确认后 featured 标识消失。
  await page.getByTestId(`toggle-featured-${itemId}`).click();
  await expect(page.getByTestId("confirm-modal")).toBeVisible();
  await page.getByTestId("confirm-modal").getByTestId("confirm-submit").click();
  await expect(page.getByTestId("action-message")).toContainText("已取消团队精选");
  await expect(page.getByTestId(`featured-badge-${itemId}`)).toHaveCount(0);

  // 精选只能作用于已批准（published）项目：同 Team 的 PENDING 项目返回 409。
  const secondItemName = `AS6 Pending NoFeature ${Date.now()}`;
  const secondItemId = await submitTeamItemForReview(page, secondItemName);
  const featureRejectRes = await page.request.post(`/api/teams/${teamId}/ai-store-featured/${secondItemId}`, {
    data: { featured: true },
  });
  expect(featureRejectRes.status()).toBe(409);
});

test("非管理角色团队成员看不到审核入口，直接访问/调用 API 均被拒绝", async ({ page, browser }) => {
  const ownerEmail = uniq("owner4");
  await registerAndLogin(page, ownerEmail);
  const teamName = `AS6 Team Gate ${Date.now()}`;
  const teamId = await createTeam(page, teamName);
  await switchTeam(page, teamId);

  // 拿邀请链接，加入一个普通成员（默认 role=member，非 owner/admin）。
  const inviteRes = await page.request.post(`/api/teams/${teamId}/invites`, { data: {} });
  expect(inviteRes.ok()).toBeTruthy();
  const inviteBody = await inviteRes.json();
  const token = inviteBody.token as string;

  const memberCtx = await browser.newContext();
  const memberPage = await memberCtx.newPage();
  const memberEmail = uniq("member");
  await registerAndLogin(memberPage, memberEmail);
  const joinRes = await memberPage.request.post("/api/teams/join", { data: { token } });
  expect(joinRes.ok()).toBeTruthy();

  // 团队页不展示审核入口区块。
  await memberPage.goto("/teams");
  await memberPage.getByTestId(`switch-${teamId}`).click().catch(() => {});
  await expect(memberPage.getByTestId("ai-store-review-entry")).toHaveCount(0);

  // 直接访问 URL：服务端 403 → 页面展示无权限态，拿不到列表数据。
  await memberPage.goto(`/teams/${teamId}/ai-store-review`);
  await expect(memberPage.getByTestId("team-ai-store-forbidden")).toBeVisible();
  await expect(memberPage.getByTestId("review-list")).toHaveCount(0);

  // 直接调用 API 也应被拒绝。
  const reviewRes = await memberPage.request.get(`/api/teams/${teamId}/ai-store-review`);
  expect(reviewRes.status()).toBe(403);
  const featuredRes = await memberPage.request.get(`/api/teams/${teamId}/ai-store-featured`);
  expect(featuredRes.status()).toBe(403);
  const reviewActionRes = await memberPage.request.post(
    `/api/teams/${teamId}/ai-store-review/999999`,
    { data: { action: "approve" } },
  );
  expect(reviewActionRes.status()).toBe(403);
  const featuredActionRes = await memberPage.request.post(
    `/api/teams/${teamId}/ai-store-featured/999999`,
    { data: { featured: true } },
  );
  expect(featuredActionRes.status()).toBe(403);

  await memberCtx.close();
});

test("其他 Team 管理员不能审核或精选来源 Team 的资源", async ({ page }) => {
  await registerAndLogin(page, uniq("cross-team"));
  const sourceTeamId = await createTeam(page, `AS6 Source Team ${Date.now()}`);
  await switchTeam(page, sourceTeamId);
  const itemId = await submitTeamItemForReview(page, `AS6 Cross Team Item ${Date.now()}`);

  const otherTeamId = await createTeam(page, `AS6 Other Team ${Date.now()}`);
  await switchTeam(page, otherTeamId);

  const reviewRes = await page.request.post(
    `/api/teams/${otherTeamId}/ai-store-review/${itemId}`,
    { data: { action: "approve" } },
  );
  expect(reviewRes.status()).toBe(404);
  const featuredRes = await page.request.post(
    `/api/teams/${otherTeamId}/ai-store-featured/${itemId}`,
    { data: { featured: true } },
  );
  expect(featuredRes.status()).toBe(404);
});
