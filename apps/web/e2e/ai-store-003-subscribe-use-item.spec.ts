import { test, expect } from "@playwright/test";

const uniq = () => `as3_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Subscriber", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const response = await page.request.post("/api/teams", {
    data: { name: `AI Store Test Team ${Date.now()}` },
  });
  expect(response.status()).toBe(201);
  return Number((await response.json()).team.id);
}

// uc-ai-store-003：订阅并使用 AI Store 项目。
// 用自己发布的一个 Agent 项目练完整闭环：订阅 → 出现在「已订阅」→ 使用（带入 AVA 会话）→ 取消订阅。
test("订阅个人发布项目、出现在已订阅列表、使用带入 AVA、取消订阅", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  // 先创建并发布一个 Agent 项目，作为可订阅的目标（复用 F02 创建流程）。
  const suffix = Date.now();
  const agentName = `Subscribe Target Agent ${suffix}`;
  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId("create-view")).toBeVisible();
  await page.getByTestId("field-name").fill(agentName);
  await page.getByTestId("field-description").fill("Agent for verifying the subscribe-and-open flow.");
  await page.getByTestId("field-config").fill("Answer questions about the subscribe flow.");
  await page.getByTestId("field-scope").selectOption("personal");
  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("已发布");

  // 回到 Explore，搜到刚发布的项目并打开详情。
  await page.getByTestId("nav-explore").click();
  await page.getByTestId("store-search").fill(agentName);
  await page.getByTestId("store-search").press("Enter");
  const card = page.getByTestId("item-grid").locator(`article:has-text("${agentName}")`);
  await expect(card).toBeVisible();
  await card.click();

  await expect(page.getByTestId("item-detail-modal")).toBeVisible();
  await expect(page.getByTestId("detail-subscribe")).toContainText("Subscribe");
  await expect(page.getByTestId("detail-subscribe")).toBeEnabled();

  // 订阅。真正的竞态根因：subscribeItem() 里 setSubscribedIds 的乐观更新发生在
  // `await fetch(...)` 之前，按钮文案（Unsubscribe）几乎瞬间翻转，早于订阅请求真正
  // 到达服务端、写入提交。实测：直接用 DB 查证过，写入本身是对的、query 谓词也对——
  // 是这条测试之前一直在等一个不可靠的信号（乐观 UI 文案），如果紧跟着去读订阅列表，
  // 会真实地读到写入还没落地的窗口。改成显式等这次 POST 的网络响应落地，而不是
  // 等按钮文案或加大 timeout（那治标不治本，本质上等的信号就是错的）。
  const subscribeRespPromise = page.waitForResponse(
    (r) => /\/api\/ai-store\/items\/\d+\/subscribe$/.test(r.url()) && r.request().method() === "POST"
  );
  await page.getByTestId("detail-subscribe").click();
  await subscribeRespPromise;
  await expect(page.getByTestId("detail-subscribe")).toContainText("Unsubscribe");
  await expect(page.getByTestId("detail-use")).toBeVisible();

  // 关闭详情弹窗，去「Subscribe」nav 视图确认它出现在已订阅列表。
  await page.getByTestId("close-detail").click();
  await page.getByTestId("nav-subscribe").click();
  await expect(page.getByTestId("subscribe-view")).toBeVisible();
  const subscribedCard = page.locator('[data-testid^="subscribed-item-"]').filter({ hasText: agentName });
  await expect(subscribedCard).toBeVisible();
  const itemId = await subscribedCard.getAttribute("data-testid").then((v) => v!.replace("subscribed-item-", ""));

  // 使用：点「Use」应带入 AVA 会话（Agent 类型 → /ava?agentItemId=）。
  const useResponse = page.waitForResponse(
    (response) => response.url().endsWith(`/api/ai-store/items/${itemId}/use`) && response.request().method() === "POST",
  );
  await page.getByTestId(`subscribed-use-${itemId}`).click();
  expect((await useResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/ava\?agentItemId=\d+/);
  await expect(page.getByTestId("composer")).toHaveValue(new RegExp(agentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  // 回到 Store，取消订阅后从已订阅列表消失。
  await page.goto("/ai-store");
  await page.getByTestId("nav-subscribe").click();
  await expect(page.getByTestId("subscribe-view")).toBeVisible();
  const subscribedCardAgain = page.locator('[data-testid^="subscribed-item-"]').filter({ hasText: agentName });
  await expect(subscribedCardAgain).toBeVisible();
  await page.getByTestId(`subscribed-unsubscribe-${itemId}`).click();
  await expect(page.getByTestId("empty")).toBeVisible();
});

// 未发布（草稿）项目不应展示可用的订阅按钮（禁用态），拥有者视角。
test("草稿项目的订阅入口为禁用态", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  const suffix = Date.now();
  const draftName = `Draft Only Agent ${suffix}`;
  await page.getByTestId("nav-create").click();
  await page.getByTestId("field-name").fill(draftName);
  await page.getByTestId("field-description").fill("Draft agent, should not be subscribable.");
  await page.getByTestId("field-config").fill("Draft config.");
  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("saved")).toContainText("草稿已保存");

  // 草稿仅属主自己可见（personal scope 未发布也在其个人可见范围内）；从 Explore 搜索找到并打开详情。
  await page.getByTestId("nav-explore").click();
  await page.getByTestId("store-search").fill(draftName);
  await page.getByTestId("store-search").press("Enter");
  const card = page.getByTestId("item-grid").locator(`article:has-text("${draftName}")`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId("detail-subscribe")).toBeDisabled();
});

// 回归（review fix）：被分享授权（F05 grantee）查看某 personal 项目的用户，在详情页能看到
// Subscribe 按钮的可见性口径必须和订阅端点的可见性口径一致——之前订阅端点用
// isAiStoreItemVisible（不含 grantee），导致 grantee 点 Subscribe 会 404。现在两边都用
// canAccessAiStoreItem，grantee 应该能正常订阅成功（不是权限口径收紧到看不到按钮）。
test("被分享授权的 grantee 可以订阅 personal 项目（不再 404）", async ({ page, browser }) => {
  // grantee：本用例主 page/context 使用的账号。
  await register(page);

  // owner：独立浏览器上下文（独立 cookie），创建、发布 personal 项目并生成分享链接。
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await register(ownerPage);
  await ownerPage.goto("/ai-store");
  const suffix = Date.now();
  const itemName = `Grantee Subscribe Item ${suffix}`;
  await ownerPage.getByTestId("nav-create").click();
  await ownerPage.getByTestId("field-name").fill(itemName);
  await ownerPage.getByTestId("field-description").fill("Owner item shared with a grantee for subscribe access test.");
  await ownerPage.getByTestId("field-config").fill("Some config.");
  await ownerPage.getByTestId("field-scope").selectOption("personal");
  await ownerPage.getByTestId("action-publish").click();
  await expect(ownerPage.getByTestId("saved")).toContainText("已发布");

  await ownerPage.getByTestId("nav-authorized").click();
  const ownerCard = ownerPage.getByTestId("owner-items").locator(`article:has-text("${itemName}")`);
  await expect(ownerCard).toBeVisible();
  const ownerCardTestId = await ownerCard.getAttribute("data-testid");
  const itemId = Number(ownerCardTestId!.replace("owner-item-", ""));

  await ownerPage.getByTestId(`share-item-${itemId}`).click();
  const modal = ownerPage.getByTestId("share-modal");
  await modal.getByTestId("share-copy-link").click();
  await expect(modal.getByTestId("share-status")).toHaveText("SHARED");
  const linkText = (await modal.getByTestId("share-link").textContent())!.trim();
  const shareToken = new URL(linkText).searchParams.get("shareToken")!;
  await modal.getByTestId("close-share-modal").click();
  await ownerCtx.close();

  // grantee（本用例主 page）打开分享链接，成为该 personal 项目的授权协作者。
  await page.goto(`/ai-store/share/${itemId}?shareToken=${encodeURIComponent(shareToken)}`);
  await expect(page.getByTestId("authorized-view")).toBeVisible();
  await expect(page.getByTestId(`authorized-item-${itemId}`)).toBeVisible();

  // grantee 直接调用订阅接口：应该成功（201），不是 404。
  const subscribeRes = await page.request.post(`/api/ai-store/items/${itemId}/subscribe`, {
    data: { scope: "personal" },
  });
  expect(subscribeRes.status()).toBe(201);

  const subscribedList = await page.request.get(`/api/ai-store/items?subscribed=me`);
  expect(subscribedList.status()).toBe(200);
  const subscribedData = (await subscribedList.json()) as { items: { id: number }[] };
  expect(subscribedData.items.some((it) => Number(it.id) === itemId)).toBeTruthy();
});

test("使用 template 项目创建独立 Board 并跳转到新 Board", async ({ page }) => {
  const teamId = await register(page);
  await page.goto("/ai-store");

  const suffix = Date.now();
  const templateName = `Use Template Item ${suffix}`;
  const roomResponse = await page.request.post("/api/rooms", {
    data: { name: `Template Source ${suffix}`, visibility: "team", teamId },
  });
  expect(roomResponse.status()).toBe(201);
  const roomId = Number((await roomResponse.json()).room.id);
  const boardResponse = await page.request.post(`/api/rooms/${roomId}/boards`, {
    data: { name: `Template Source Board ${suffix}` },
  });
  expect(boardResponse.status()).toBe(201);
  const boardId = Number((await boardResponse.json()).board.id);
  expect((await page.request.post(`/api/boards/${boardId}/items`, {
    data: { type: "note", x: 20, y: 20, text: "Template content" },
  })).status()).toBe(201);
  const templateResponse = await page.request.post("/api/ai-store/items", { data: {
    type: "template",
    scope: "personal",
    action: "publish",
    name: templateName,
    description: "Template item used to verify Board instantiation.",
    config: "Template config.",
    templateBoardId: boardId,
  } });
  expect(templateResponse.status()).toBe(201);

  await page.getByTestId("nav-explore").click();
  await page.getByTestId("store-search").fill(templateName);
  await page.getByTestId("store-search").press("Enter");
  const card = page.getByTestId("item-grid").locator(`article:has-text("${templateName}")`);
  await expect(card).toBeVisible();
  await card.click();
  const subscribeResponse = page.waitForResponse(
    (response) => /\/api\/ai-store\/items\/\d+\/subscribe$/.test(response.url()) && response.request().method() === "POST",
  );
  await page.getByTestId("detail-subscribe").click();
  expect((await subscribeResponse).status()).toBe(201);
  await expect(page.getByTestId("detail-use")).toBeVisible();

  const useResponse = page.waitForResponse(
    (response) => /\/api\/ai-store\/items\/\d+\/use$/.test(response.url()) && response.request().method() === "POST",
  );
  await page.getByTestId("detail-use").click();
  const used = await useResponse;
  expect([200, 201]).toContain(used.status());
  const instantiated = await used.json();
  await expect(page).toHaveURL(/\/boards\/[A-Za-z0-9_-]+$/);
  const copiedItems = await (await page.request.get(`/api/boards/${instantiated.board.id}/items`)).json();
  expect(copiedItems.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: "Template content" }),
  ]));
});

// 个人订阅也属于当前 Team。切换到其他 Team 后不可见，切回原 Team 后可继续管理。
test("个人订阅按 Team 隔离，切回原 Team 后可成功取消", async ({ page }) => {
  const originalTeamId = await register(page);
  await page.goto("/ai-store");

  const suffix = Date.now();
  const itemName = `Cross Team Unsubscribe Item ${suffix}`;
  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId("create-view")).toBeVisible();
  await page.getByTestId("field-name").fill(itemName);
  await page.getByTestId("field-description").fill("Agent for verifying unsubscribe across team-context switch.");
  await page.getByTestId("field-config").fill("Answer questions about the cross-team unsubscribe flow.");
  await page.getByTestId("field-scope").selectOption("personal");
  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("已发布");

  await page.getByTestId("nav-explore").click();
  await page.getByTestId("store-search").fill(itemName);
  await page.getByTestId("store-search").press("Enter");
  const card = page.getByTestId("item-grid").locator(`article:has-text("${itemName}")`);
  await expect(card).toBeVisible();
  await card.click();
  const itemId = Number((await card.getAttribute("data-testid"))!.replace("item-", ""));

  const subscribeRes = await page.request.post(`/api/ai-store/items/${itemId}/subscribe`, {
    data: { scope: "personal" },
  });
  expect(subscribeRes.status()).toBe(201);

  const beforeSwitch = await (
    await page.request.get(`/api/ai-store/items/${itemId}/subscribe`)
  ).json();
  expect(beforeSwitch.subscribed).toBe(true);

  // 创建第二个 Team 会切换当前 Team，原 Team 的个人订阅不可跨 Team 使用。
  const teamRes = await (
    await page.request.post("/api/teams", { data: { name: `Cross Unsub Team ${suffix}` } })
  ).json();
  const teamId = teamRes.team.id as number;
  expect(Number(teamId)).not.toBe(originalTeamId);
  const currentTeam = await (await page.request.get("/api/teams/current")).json();
  expect(String(currentTeam.teamId)).toBe(String(teamId));

  const afterSwitch = await page.request.get(`/api/ai-store/items/${itemId}/subscribe`);
  expect(afterSwitch.status()).toBe(404);

  expect((await page.request.post("/api/teams/current", {
    data: { teamId: originalTeamId },
  })).status()).toBe(200);
  const afterReturn = await (
    await page.request.get(`/api/ai-store/items/${itemId}/subscribe`)
  ).json();
  expect(afterReturn.subscribed).toBe(true);

  const unsubscribeRes = await page.request.delete(
    `/api/ai-store/items/${itemId}/subscribe?scope=personal`,
  );
  expect(unsubscribeRes.status()).toBe(200);
  const unsubscribeBody = await unsubscribeRes.json();
  expect(unsubscribeBody.ok).toBe(true);

  // 确认订阅行确实被清除：GET 应报告 subscribed:false。
  const afterUnsubscribe = await (
    await page.request.get(`/api/ai-store/items/${itemId}/subscribe`)
  ).json();
  expect(afterUnsubscribe.subscribed).toBe(false);
  expect(afterUnsubscribe.personal).toBe(false);
});
