import { test, expect } from "@playwright/test";

const uniq = () => `as3_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Subscriber", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });
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

  // 订阅。
  await page.getByTestId("detail-subscribe").click();
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
  await page.getByTestId(`subscribed-use-${itemId}`).click();
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
  const ownerEmail = uniq();
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await ownerPage.request.post("/api/auth/register", {
    data: { firstName: "Owner", lastName: "Grantee", email: ownerEmail, password: "secret123", agreeTerms: true },
  });
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

// 回归（review fix）：template 类型的「Use」目前只能跳到 /boards（没有按模板建板的后端管线），
// 之前落地是静默的，容易让用户误以为已经按模板建好了板。现在 /boards 要在 ?template= 参数
// 存在时展示明确提示，且 URL 上的 query 参数要被清理掉（不留脏 query）。
test("使用 template 项目跳到 Boards 时显示开发中提示", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  const suffix = Date.now();
  const templateName = `Use Template Item ${suffix}`;
  await page.getByTestId("nav-create").click();
  await page.getByTestId("creator-type-template").click();
  await page.getByTestId("field-name").fill(templateName);
  await page.getByTestId("field-description").fill("Template item used to verify the Use-notice regression fix.");
  await page.getByTestId("field-config").fill("Template config.");
  await page.getByTestId("field-scope").selectOption("personal");
  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("已发布");

  await page.getByTestId("nav-explore").click();
  await page.getByTestId("store-search").fill(templateName);
  await page.getByTestId("store-search").press("Enter");
  const card = page.getByTestId("item-grid").locator(`article:has-text("${templateName}")`);
  await expect(card).toBeVisible();
  await card.click();
  await page.getByTestId("detail-subscribe").click();
  await expect(page.getByTestId("detail-use")).toBeVisible();

  await page.getByTestId("detail-use").click();
  await expect(page).toHaveURL(/\/boards$/);
  await expect(page.getByTestId("template-use-notice")).toBeVisible();
  await expect(page.getByTestId("template-use-notice")).toContainText("开发中");
});

// 回归（review fix）：unsubscribeAiStoreItem 的 WHERE 匹配口径必须和 getAiStoreSubscription
// 一致。此前 unsubscribe 用 COALESCE(team_id,0) = COALESCE($3,0) 做严格相等匹配，
// 与 getAiStoreSubscription 的 "(team_id IS NULL OR team_id = $3)" 宽匹配不对称：
// 用户在没有当前团队（teamId cookie 为 null）时个人订阅了某项目（team_id=NULL 落库），
// 之后切换进一个团队（cookie 变成该团队 id），GET 订阅状态接口仍靠 OR 匹配命中该 NULL 行、
// 报 subscribed:true；但 DELETE 若按严格相等去找 team_id=当前团队 id 的行，则找不到、
// 误报 404（"未找到订阅"）——用户被卡住：UI 显示已订阅、点取消订阅却失败。
test("在无团队上下文订阅后切换进团队，仍可成功取消订阅", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  // 以当前（无团队上下文）身份创建并发布一个项目，作为订阅目标。
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

  // 个人订阅：此时没有当前团队（teamId cookie 为 null）→ 订阅行 team_id = NULL 落库。
  const subscribeRes = await page.request.post(`/api/ai-store/items/${itemId}/subscribe`, {
    data: { scope: "personal" },
  });
  expect(subscribeRes.status()).toBe(201);

  const beforeSwitch = await (
    await page.request.get(`/api/ai-store/items/${itemId}/subscribe`)
  ).json();
  expect(beforeSwitch.subscribed).toBe(true);

  // 创建一个团队并切换进去：CURRENT_TEAM_COOKIE 现在变成该团队 id（非 null）。
  const teamRes = await (
    await page.request.post("/api/teams", { data: { name: `Cross Unsub Team ${suffix}` } })
  ).json();
  const teamId = teamRes.team.id as number;
  const currentTeam = await (await page.request.get("/api/teams/current")).json();
  expect(String(currentTeam.teamId)).toBe(String(teamId));

  // GET 订阅状态：切换团队上下文后，宽匹配（team_id IS NULL OR team_id = teamId）仍应命中
  // 之前个人订阅的那一行,报告 subscribed:true（UI 会展示为已订阅、可点取消）。
  const afterSwitch = await (
    await page.request.get(`/api/ai-store/items/${itemId}/subscribe`)
  ).json();
  expect(afterSwitch.subscribed).toBe(true);

  // 取消订阅：在团队上下文里删除，必须成功（不能 404 "未找到订阅"）。
  const unsubscribeRes = await page.request.delete(`/api/ai-store/items/${itemId}/subscribe`);
  expect(unsubscribeRes.status()).toBe(200);
  const unsubscribeBody = await unsubscribeRes.json();
  expect(unsubscribeBody.ok).toBe(true);

  // 确认订阅行确实被清除：GET 应报告 subscribed:false。
  const afterUnsubscribe = await (
    await page.request.get(`/api/ai-store/items/${itemId}/subscribe`)
  ).json();
  expect(afterUnsubscribe.subscribed).toBe(false);
  expect(afterUnsubscribe.subscription).toBeNull();
});
