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
