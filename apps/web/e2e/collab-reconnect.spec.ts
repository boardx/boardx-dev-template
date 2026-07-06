import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { expectItemCount } from "./helpers/canvas";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;

async function register(ctx: APIRequestContext, email: string, firstName = "U", lastName = "U") {
  const res = await ctx.post("/api/auth/register", {
    data: { firstName, lastName, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function selfId(page: Page): Promise<number> {
  const raw = await page
    .getByTestId("board-presence")
    .locator('[data-testid="presence-member"][data-self="true"]')
    .first()
    .getAttribute("data-member-id");
  const id = Number(raw);
  expect(Number.isFinite(id)).toBeTruthy();
  return id;
}

async function moveInsideCanvas(page: Page) {
  const box = await page.getByTestId("canvas-viewport").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.45, { steps: 5 });
}

// p6:F13：item 计数锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。

test("连接异常显示在 Header，自动重连后继续同步；协作者离线移除头像与光标", async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext({ baseURL: BASE });
  const ctxB: BrowserContext = await browser.newContext({ baseURL: BASE });
  try {
    const emailA = uniq("reconnectA");
    const emailB = uniq("reconnectB");
    await register(ctxA.request, emailA, "Reconnect", "Owner");
    await register(ctxB.request, emailB, "Reconnect", "Editor");
    const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Reconnect" } })).json()).room;
    const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Reconnect Board" } })).json()).board;
    const invite = await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });
    expect(invite.ok()).toBeTruthy();

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);

    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 20_000 });
    await expect(pageB.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 20_000 });
    await expect(pageB.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "synced", { timeout: 20_000 });

    // 模拟一次真实网络断开：直接砍掉底层 WebSocket（e2e 专用调试句柄，仅
    // NODE_ENV!==production 时暴露，见 board-canvas.tsx）。
    await pageB.evaluate(() => {
      const ws = (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs;
      if (!ws) throw new Error("missing collab websocket");
      ws.close();
    });
    await expect(pageB.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "offline", { timeout: 10_000 });
    await expect(pageB.getByTestId("board-sync-label")).toHaveText("连接异常");
    // 指数退避重连：首次重试延迟 1s，10s 内足够完成至少一次重连。
    await expect(pageB.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "synced", { timeout: 20_000 });

    // 重连后同步仍然正常工作：断线期间没有产生的内容，恢复后新建的内容双方都能看到。
    await expectItemCount(pageA, 0);
    await expectItemCount(pageB, 0);
    await pageA.getByTestId("add-note").click();
    await expectItemCount(pageA, 1);
    await expectItemCount(pageB, 1);

    const bId = await selfId(pageB);
    await moveInsideCanvas(pageB);
    await expect(pageA.getByTestId(`collab-cursor-${bId}`)).toBeVisible({ timeout: 15_000 });

    // 协作者离线：presence 心跳超时后头像/光标从对方画布上移除。
    await pageB.close();
    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "1", { timeout: 20_000 });
    await expect(pageA.getByTestId(`collab-cursor-${bId}`)).toBeHidden();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("会话失效时不再自动重连，避免对网关的无意义重试风暴", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  try {
    await register(ctx.request, uniq("reconnectAuth"), "Auth", "User");
    const room = (await (await ctx.request.post("/api/rooms", { data: { name: "AuthDrop" } })).json()).room;
    const board = (await (await ctx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "AuthDrop Board" } })).json()).board;
    const page = await ctx.newPage();
    await page.goto(`/boards/${board.id}`);
    await expect(page.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "synced", { timeout: 20_000 });

    // 服务端登出（会话立即失效），再断开底层连接，模拟"重连时会话已过期"。
    await ctx.request.post("/api/auth/logout");
    await page.evaluate(() => {
      const ws = (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs;
      ws?.close();
    });
    await expect(page.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "offline", { timeout: 10_000 });

    // 关键断言：不会自动恢复成 synced——鉴权失败后不再自动重连。给足够长的
    // 观察窗口（覆盖至少两轮指数退避），状态应该始终停在 offline。
    await page.waitForTimeout(6_000);
    await expect(page.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "offline");
  } finally {
    await ctx.close();
  }
});
