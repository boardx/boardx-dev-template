import { request as httpRequest } from "node:http";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;
const WS_PORT = process.env.COLLAB_WS_PORT ?? "3001";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// F01 要求 upgrade 时校验登录态 + 对该 boardId 的访问权限（不只是"登录了"）：
// 连接前先注册登录拿 session cookie，再建一个真实 room+board 并把第二个用户拉进去，
// 让双方都是这个 board 的合法成员（cookie 按 domain 匹配、不区分端口，浏览器会
// 把它一并发给 ws://localhost:{WS_PORT}）。
async function login(context: BrowserContext, prefix: string) {
  const res = await context.request.post(`${BASE}/api/auth/register`, {
    data: { firstName: "C", lastName: "D", email: uniq(prefix), password: "secret123", agreeTerms: true },
  });
  if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
}

/** 用 ownerCtx 建一个真实 room+board，并把 memberCtx（若提供）拉进房间成为合法成员。 */
async function createRealBoard(ownerCtx: BrowserContext, memberCtx?: BrowserContext): Promise<string> {
  const room = (await (await ownerCtx.request.post(`${BASE}/api/rooms`, { data: { name: "collab-transport" } })).json())
    .room;
  const board = (
    await (await ownerCtx.request.post(`${BASE}/api/rooms/${room.id}/boards`, { data: { name: "transport" } })).json()
  ).board;
  if (memberCtx) {
    const memberSession = await memberCtx.request.get(`${BASE}/api/auth/session`);
    const memberEmail = (await memberSession.json())?.user?.email;
    const invite = await ownerCtx.request.post(`${BASE}/api/rooms/${room.id}/members`, { data: { email: memberEmail } });
    if (!invite.ok()) throw new Error(`invite failed: ${invite.status()} ${await invite.text()}`);
  }
  return String(board.id);
}

// 浏览器 WebSocket API 在握手失败时只暴露笼统的 error/close 事件，拿不到真实 HTTP
// 状态码；直接用 Node 的 http.request 发 upgrade 请求，能读到网关真实回的状态行，
// 避免"进程崩了也能通过"这类假阳性。
function attemptUpgrade(boardId: string, cookie?: string): Promise<{ status: number | null; upgraded: boolean }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      host: "localhost",
      port: Number(WS_PORT),
      path: `/api/collab/ws?boardId=${encodeURIComponent(boardId)}`,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        ...(cookie ? { cookie } : {}),
      },
    });
    req.on("response", (res) => {
      resolve({ status: res.statusCode ?? null, upgraded: false });
      req.destroy();
    });
    req.on("upgrade", (res, socket) => {
      resolve({ status: res.statusCode ?? 101, upgraded: true });
      socket.destroy();
    });
    req.on("error", reject);
    req.end();
  });
}

function wsUrl(boardId: string): string {
  return `ws://localhost:${WS_PORT}/api/collab/ws?boardId=${encodeURIComponent(boardId)}`;
}

function cookieHeaderFor(ctx: BrowserContext): Promise<string> {
  return ctx.cookies().then((cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; "));
}

async function connect(page: Page, url: string, eventName: string) {
  await page.evaluate(
    ({ url, eventName }) => {
      (window as any).__collabMessages ??= {};
      (window as any).__collabMessages[eventName] ??= [];
      const ws = new WebSocket(url);
      (window as any).__collabWs = ws;
      ws.addEventListener("message", (event) => {
        (window as any).__collabMessages[eventName].push(JSON.parse(event.data));
      });
      ws.addEventListener("error", () => {
        (window as any).__collabMessages[eventName].push({ type: "error" });
      });
    },
    { url, eventName },
  );
}

async function waitForMessage(page: Page, eventName: string, predicate: (msg: any) => boolean) {
  const handle = await page.waitForFunction(
    ({ eventName, predicateSource }) =>
      ((window as any).__collabMessages?.[eventName] ?? []).find((msg: any) => {
        const pred = new Function("msg", `return (${predicateSource})(msg);`) as (msg: any) => boolean;
        return pred(msg);
      }) ?? null,
    { eventName, predicateSource: predicate.toString() },
  );
  return handle.jsonValue();
}

test("两个 board 成员通过 WebSocket + Redis pub/sub 在同一 Board channel 收发消息", async ({ browser }) => {
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  await login(ctxA, "transportOwner");
  await login(ctxB, "transportMember");
  const boardId = await createRealBoard(ctxA, ctxB); // A 是 owner，B 被邀进房间成为合法成员
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  try {
    await pageA.goto("/api/health");
    await pageB.goto("/api/health");
    await connect(pageA, wsUrl(boardId), "collab-a");
    await connect(pageB, wsUrl(boardId), "collab-b");
    await waitForMessage(pageA, "collab-a", (msg) => msg.type === "connected");
    await waitForMessage(pageB, "collab-b", (msg) => msg.type === "connected");

    const received = waitForMessage(
      pageB,
      "collab-b",
      (msg) => msg.type === "message" && msg.via === "redis" && msg.data === "hello-through-redis",
    );
    await pageA.evaluate(() => (window as any).__collabWs.send("hello-through-redis"));
    await expect(received).resolves.toMatchObject({ boardId, data: "hello-through-redis", via: "redis" });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("客户端断线后重新连接仍能通过同一 Board channel 收发", async ({ browser }) => {
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  await login(ctxA, "reconnOwner");
  await login(ctxB, "reconnMember");
  const boardId = await createRealBoard(ctxA, ctxB);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  try {
    await pageA.goto("/api/health");
    await pageB.goto("/api/health");
    await connect(pageA, wsUrl(boardId), "collab-a");
    await connect(pageB, wsUrl(boardId), "collab-b");
    await waitForMessage(pageA, "collab-a", (msg) => msg.type === "connected");
    await waitForMessage(pageB, "collab-b", (msg) => msg.type === "connected");
    await pageB.evaluate(() => (window as any).__collabWs.close());

    await connect(pageB, wsUrl(boardId), "collab-b-reconnected");
    await waitForMessage(pageB, "collab-b-reconnected", (msg) => msg.type === "connected");
    const received = waitForMessage(
      pageB,
      "collab-b-reconnected",
      (msg) => msg.type === "message" && msg.via === "redis" && msg.data === "after-reconnect",
    );
    await pageA.evaluate(() => (window as any).__collabWs.send("after-reconnect"));
    await expect(received).resolves.toMatchObject({ boardId, data: "after-reconnect", via: "redis" });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("未登录连接被拒绝：不带 session cookie 时 upgrade 返回 401，不会完成握手", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  try {
    await login(ownerCtx, "unauthOwner");
    const boardId = await createRealBoard(ownerCtx);
    const result = await attemptUpgrade(boardId);
    expect(result.upgraded).toBe(false);
    expect(result.status).toBe(401);
  } finally {
    await ownerCtx.close();
  }
});

test("已登录但不是该 board 成员的连接被拒绝：upgrade 返回 403（不是横向越权）", async ({ browser }) => {
  // 这条用例是补上的：早期实现只校验"是否登录"，没校验"是否有权访问这个
  // boardId"——任何登录用户带上任意 boardId 就能连进去，是真实的横向越权洞。
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const strangerCtx = await browser.newContext({ baseURL: BASE });
  try {
    await login(ownerCtx, "authzOwner");
    await login(strangerCtx, "authzStranger"); // 登录但从未被邀进这个房间/board
    const boardId = await createRealBoard(ownerCtx); // 不传 memberCtx：stranger 不是成员
    const cookie = await cookieHeaderFor(strangerCtx);
    const result = await attemptUpgrade(boardId, cookie);
    expect(result.upgraded).toBe(false);
    expect(result.status).toBe(403);
  } finally {
    await ownerCtx.close();
    await strangerCtx.close();
  }
});

test("已登录且是该 board 成员的连接被接受：upgrade 返回 101", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  try {
    await login(ctx, "authOk");
    const boardId = await createRealBoard(ctx); // owner 对自己创建的 board 天然有权限
    const cookie = await cookieHeaderFor(ctx);
    const result = await attemptUpgrade(boardId, cookie);
    expect(result.upgraded).toBe(true);
    expect(result.status).toBe(101);
  } finally {
    await ctx.close();
  }
});
