import { test, expect } from "@playwright/test";

// P18-F12: 分享只读页四态 e2e 补齐 + Agent 禁用态断言。
// 设计稿：phases/requirements/mockups/chat-share-readonly.html 显式列出四种状态变体
// （Loading / Invalid / Unavailable / Empty），p9-F05 的实现四态俱在，但验证只覆盖了
// 三个「终态」——Loading 骨架屏从未被断言过（加载足够快时肉眼永远看不到，坏了也没人知道）。
// 本 spec 是 F12 的完成契约：四态各自可见 + /ava 的 Agent 锁定禁用态。
// 与 e2e/share-view-chat.spec.ts（F05 契约）并存：那边守 F05 行为不回归，这边是
// F12 的独立验证面，允许少量重叠。

const uniq = () => `share_states_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(request: import("@playwright/test").APIRequestContext) {
  await request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "T", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

/** 建一个已开启分享的空线程；closeShare 用 owner 身份关闭分享（供 Unavailable 用例）。 */
async function makeSharedThread(
  playwright: typeof import("@playwright/test"),
  baseURL: string | undefined
): Promise<{
  threadId: number;
  token: string;
  closeShare: () => Promise<number>;
  dispose: () => Promise<void>;
}> {
  const owner = await playwright.request.newContext({ baseURL });
  await register(owner);
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;
  const { share } = await (await owner.post(`/api/ava/threads/${thread.id}/share`)).json();
  return {
    threadId: thread.id,
    token: share.share_token,
    closeShare: async () => (await owner.delete(`/api/ava/threads/${thread.id}/share`)).status(),
    dispose: () => owner.dispose(),
  };
}

test.describe("P18-F12 分享只读页四态", () => {
  test("状态一 Loading：请求在途时展示骨架屏，完成后进入正常渲染", async ({
    playwright,
    baseURL,
    page,
  }) => {
    const { threadId, token, dispose } = await makeSharedThread(playwright, baseURL);

    // 拦住 chatShare API，握着不放行——Loading 态变成确定性可断言（而不是赌加载够慢）。
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/chatShare/${threadId}**`, async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto(`/chatShare/${threadId}?shareToken=${token}`);
    await expect(page.getByTestId("loading")).toBeVisible();
    // 加载中不得出现任何终态元素
    await expect(page.getByTestId("shared-message-list")).toHaveCount(0);
    await expect(page.getByTestId("share-unavailable")).toHaveCount(0);

    release();
    await expect(page.getByTestId("share-title")).toBeVisible();
    await expect(page.getByTestId("loading")).toHaveCount(0);

    await dispose();
  });

  test("状态二 Invalid：threadId 非法或 token 缺失 → Invalid chat session", async ({ page }) => {
    await page.goto("/chatShare/not-a-number?shareToken=whatever");
    await expect(page.getByTestId("invalid-chat-session")).toBeVisible();
    await expect(page.getByTestId("invalid-chat-session")).toContainText("Invalid chat session");

    await page.goto("/chatShare/123"); // 缺 token
    await expect(page.getByTestId("invalid-chat-session")).toBeVisible();
    await expect(page.locator("textarea")).toHaveCount(0);
  });

  test("状态三 Unavailable：token 错误或分享已关闭 → 不可访问", async ({
    playwright,
    baseURL,
    page,
  }) => {
    const { threadId, token, closeShare, dispose } = await makeSharedThread(playwright, baseURL);

    // 3a. token 错误
    await page.goto(`/chatShare/${threadId}?shareToken=wrong-token`);
    await expect(page.getByTestId("share-unavailable")).toBeVisible();
    await expect(page.getByTestId("shared-message-list")).toHaveCount(0);

    // 3b. 关闭分享后，原本有效的 token 立即失效
    await page.goto(`/chatShare/${threadId}?shareToken=${token}`);
    await expect(page.getByTestId("share-title")).toBeVisible(); // 关闭前有效

    expect(await closeShare()).toBe(200);
    await page.reload();
    await expect(page.getByTestId("share-unavailable")).toBeVisible();
    await expect(page.getByTestId("share-title")).toHaveCount(0);

    await dispose();
  });

  test("状态四 Empty：空线程展示 No messages，且保留只读底栏", async ({
    playwright,
    baseURL,
    page,
  }) => {
    const { threadId, token, dispose } = await makeSharedThread(playwright, baseURL);

    await page.goto(`/chatShare/${threadId}?shareToken=${token}`);
    await expect(page.getByTestId("share-title")).toBeVisible();
    await expect(page.getByTestId("empty")).toContainText("No messages");
    await expect(page.getByTestId("readonly-banner")).toContainText("Read only");
    await expect(page.locator("textarea")).toHaveCount(0);

    await dispose();
  });
});

test.describe("P18-F12 Agent 锁定禁用态（uc-ava-006 边界）", () => {
  test("线程已有消息后，agent-select 呈禁用态且展示锁定提示（点击前即可见，非点击后报错）", async ({
    page,
  }) => {
    await register(page.request);
    await page.goto("/ava");

    // 新线程（无消息）时 Agent 可切换
    await expect(page.getByTestId("agent-select")).toBeEnabled();
    await expect(page.getByTestId("agent-locked")).toHaveCount(0);

    await page.getByTestId("composer").fill("锁定 Agent 的第一条消息");
    await page.getByTestId("send").click();
    await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });

    // 有消息后：禁用态直接可见（用户不需要点了才知道不可切换）
    await expect(page.getByTestId("agent-select")).toBeDisabled();
    await expect(page.getByTestId("agent-locked")).toBeVisible();
    await expect(page.getByTestId("agent-locked")).toContainText("locked");
  });
});
