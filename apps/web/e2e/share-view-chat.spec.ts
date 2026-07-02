import { test, expect } from "@playwright/test";

// uc-share-001 / P9-F05: 公开分享对话只读页 /chatShare/:threadId
// 覆盖 F05 的 user_visible_behavior：无需登录访问；有效分享按时间顺序只读渲染消息，
// 底部 Read only 提示，无 composer/发送；threadId 或 token 缺失显示 Invalid chat session；
// token 无效/分享已关闭显示不可访问；空线程显示 No messages。
// 复用 F04（分享生成）落地的真实数据面：POST /api/ava/threads、/api/ava/threads/:id/share。

const uniq = () => `share_view_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(request: import("@playwright/test").APIRequestContext) {
  await request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test.describe("公开分享对话只读页 /chatShare/:threadId", () => {
  test("有效分享链接（未登录）按时间顺序只读渲染消息，无输入框/发送", async ({ playwright, baseURL, page }) => {
    await register(page.request);

    // 走真实 UI 发送链路创建线程 + 首条消息（发消息走 SSE 流式生成，走 UI 保证真实链路）
    await page.goto("/ava");
    await page.getByTestId("composer").fill("第一条：请介绍一下自己");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });

    const threadsRes = await page.request.get("/api/ava/threads");
    const { threads } = await threadsRes.json();
    const threadId = threads[0].id;

    const shareRes = await page.request.post(`/api/ava/threads/${threadId}/share`);
    expect(shareRes.status()).toBe(201);
    const { share } = await shareRes.json();

    // 未登录访问公开只读页
    await page.context().clearCookies();
    await page.goto(`/chatShare/${threadId}?shareToken=${share.share_token}`);

    await expect(page.getByTestId("share-title")).toBeVisible();
    const list = page.getByTestId("shared-message-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText("第一条：请介绍一下自己");

    // 消息按时间顺序渲染：第一条用户消息在前
    const items = list.locator("li");
    await expect(items.first()).toContainText("第一条：请介绍一下自己");

    await expect(page.getByTestId("readonly-banner")).toContainText("Read only");

    // 只读：无 composer / 输入框 / 发送按钮
    await expect(page.locator("textarea")).toHaveCount(0);
    await expect(page.getByTestId("send")).toHaveCount(0);
  });

  test("threadId 或 token 缺失显示 Invalid chat session", async ({ page }) => {
    await page.goto("/chatShare/not-a-number?shareToken=whatever");
    await expect(page.getByTestId("invalid-chat-session")).toBeVisible();
    await expect(page.getByTestId("invalid-chat-session")).toContainText("Invalid chat session");
    await expect(page.getByTestId("shared-message-list")).toHaveCount(0);
    await expect(page.locator("textarea")).toHaveCount(0);

    await page.goto("/chatShare/123");
    await expect(page.getByTestId("invalid-chat-session")).toBeVisible();
  });

  test("token 无效或分享已关闭显示不可访问", async ({ playwright, baseURL, page }) => {
    const owner = await playwright.request.newContext({ baseURL });
    await register(owner);
    const thread = (await (await owner.post("/api/ava/threads")).json()).thread;

    // 从未开启分享：随意 token 直接不可访问
    await page.goto(`/chatShare/${thread.id}?shareToken=nope`);
    await expect(page.getByTestId("share-unavailable")).toBeVisible();

    const shareRes = await owner.post(`/api/ava/threads/${thread.id}/share`);
    const { share } = await shareRes.json();
    const closeRes = await owner.delete(`/api/ava/threads/${thread.id}/share`);
    expect(closeRes.status()).toBe(200);

    await page.goto(`/chatShare/${thread.id}?shareToken=${share.share_token}`);
    await expect(page.getByTestId("share-unavailable")).toBeVisible();
    await expect(page.getByTestId("shared-message-list")).toHaveCount(0);

    await owner.dispose();
  });

  test("空线程显示 No messages，仍带只读底栏", async ({ playwright, baseURL, page }) => {
    const owner = await playwright.request.newContext({ baseURL });
    await register(owner);
    const thread = (await (await owner.post("/api/ava/threads")).json()).thread;
    const shareRes = await owner.post(`/api/ava/threads/${thread.id}/share`);
    const { share } = await shareRes.json();

    await page.goto(`/chatShare/${thread.id}?shareToken=${share.share_token}`);
    await expect(page.getByTestId("share-title")).toBeVisible();
    await expect(page.getByTestId("empty")).toContainText("No messages");
    await expect(page.getByTestId("readonly-banner")).toBeVisible();
    await expect(page.locator("textarea")).toHaveCount(0);

    await owner.dispose();
  });
});
