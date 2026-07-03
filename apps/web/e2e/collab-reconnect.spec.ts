import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

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

const items = (page: Page) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

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

    await pageB.evaluate(() => {
      const ws = (window as Window & { __boardCollabWs?: WebSocket | null }).__boardCollabWs;
      if (!ws) throw new Error("missing collab websocket");
      ws.close();
    });
    await expect(pageB.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "offline", { timeout: 10_000 });
    await expect(pageB.getByTestId("board-sync-label")).toHaveText("连接异常");
    await expect(pageB.getByTestId("board-sync-status")).toHaveAttribute("data-sync-state", "synced", { timeout: 20_000 });

    await expect(items(pageA)).toHaveCount(0);
    await expect(items(pageB)).toHaveCount(0);
    await pageA.getByTestId("add-note").click();
    await expect(items(pageA)).toHaveCount(1);
    await expect(items(pageB)).toHaveCount(1, { timeout: 10_000 });

    const bId = await selfId(pageB);
    await moveInsideCanvas(pageB);
    await expect(pageA.getByTestId(`collab-cursor-${bId}`)).toBeVisible({ timeout: 15_000 });
    await pageB.close();
    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "1", { timeout: 20_000 });
    await expect(pageA.getByTestId(`collab-cursor-${bId}`)).toBeHidden();
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
