import { test, expect, type BrowserContext, type APIRequestContext } from "@playwright/test";

// uc-canvas-005 画布实时协作
// 后置条件 1：在线用户看到一致的 Board 内容、在线成员状态和同步状态；
//             无权限用户不能通过协作通道写入内容。
//
// 用两个独立浏览器 context 模拟两名真实在线用户，验证真实跨客户端传播：
// A 新增便签 → B 的画布（轮询同步）出现同一个 item。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE = process.env.PW_BASE_URL ?? "http://localhost:3000";

async function register(ctx: APIRequestContext, email: string) {
  const res = await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

test("两名协作者：在线成员 + 同步状态 + 跨客户端内容一致", async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext({ baseURL: BASE });
  const ctxB: BrowserContext = await browser.newContext({ baseURL: BASE });
  try {
    // A 是 owner：注册 → 建房间 → 建 board。
    const emailA = uniq("collabA");
    await register(ctxA.request, emailA);
    const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Collab" } })).json()).room;
    const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "RT" } })).json()).board;

    // B 是第二名成员：注册 → 由 owner 邀请进房间（→ board editor 角色）。
    const emailB = uniq("collabB");
    await register(ctxB.request, emailB);
    const invite = await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });
    expect(invite.ok()).toBeTruthy();

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);

    // 两端都渲染出实时协作区域（在线成员 + 同步状态）。
    await expect(pageA.getByTestId("board-presence")).toBeVisible();
    await expect(pageB.getByTestId("board-presence")).toBeVisible();
    await expect(pageA.getByTestId("board-sync-status")).toBeVisible();

    // UC 主流程 2：两名用户在线后，双方都看到在线成员数量达到 2。
    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });
    await expect(pageB.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });
    await expect(pageA.getByTestId("presence-avatar")).toHaveCount(2);

    // 稳态同步状态可见（业务规则 3：让用户知道内容是否已同步）。
    await expect(pageA.getByTestId("board-sync-dot")).toBeVisible();

    // 起点：两端画布都为空。
    await expect(pageA.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(0);
    await expect(pageB.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(0);

    // UC 主流程 4/5：A 新增便签 → B 的画布（轮询）收到同一变化，内容达到一致。
    await pageA.getByTestId("add-note").click();
    await expect(pageA.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(1);
    await expect(pageB.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(1, { timeout: 15_000 });

    // 反向：B 也新增一个 → A 收到 → 两端都为 2（真实双向传播）。
    await pageB.getByTestId("add-note").click();
    await expect(pageB.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(2);
    await expect(pageA.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(2, { timeout: 15_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("离开后在线成员数量回落（UC 主流程 6）", async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext({ baseURL: BASE });
  const ctxB: BrowserContext = await browser.newContext({ baseURL: BASE });
  try {
    const emailA = uniq("leaveA");
    await register(ctxA.request, emailA);
    const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Leave" } })).json()).room;
    const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "RT2" } })).json()).board;

    const emailB = uniq("leaveB");
    await register(ctxB.request, emailB);
    await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);
    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });

    // B 关闭页面 → 心跳停止 → A 侧在线数量回落到 1。
    await pageB.close();
    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "1", { timeout: 20_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("无权限者不能通过协作/items 通道写入 → 403", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const outsiderCtx = await browser.newContext({ baseURL: BASE });
  try {
    // owner 建一个私有房间 + board。
    await register(ownerCtx.request, uniq("owner"));
    const room = (await (await ownerCtx.request.post("/api/rooms", { data: { name: "Priv", visibility: "private" } })).json()).room;
    const board = (await (await ownerCtx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Locked" } })).json()).board;

    // 局外人（非成员）已登录，但不是该房间/board 成员。
    await register(outsiderCtx.request, uniq("outsider"));

    // 协作写通道（board items）：局外人写入 → 403。
    const write = await outsiderCtx.request.post(`/api/boards/${board.id}/items`, {
      data: { type: "note", x: 10, y: 10, text: "hack" },
    });
    expect(write.status()).toBe(403);

    // presence 心跳通道同样门控：局外人 → 403。
    const presence = await outsiderCtx.request.post(`/api/boards/${board.id}/presence`);
    expect(presence.status()).toBe(403);
  } finally {
    await ownerCtx.close();
    await outsiderCtx.close();
  }
});
