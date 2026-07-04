import { request as httpRequest } from "node:http";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;
const WS_PORT = process.env.COLLAB_WS_PORT ?? "3001";

const uniq = () => `collab_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// F01 review 修复：升级鉴权从"只验证登录态"改为"验证该用户对目标 board 有访问权限"
// （见 collab-gateway.mjs 的 isAuthorizedForBoard）。测试因此需要真实的 board：
// 注册一个用户、开房间、建白板，拿到真实数字 boardId 与该用户的 session cookie。
async function registerAndCreateBoard(context: BrowserContext): Promise<{ boardId: string; cookieHeader: string }> {
  const email = uniq();
  const res = await context.request.post(`${BASE}/api/auth/register`, {
    data: { firstName: "C", lastName: "D", email, password: "secret123", agreeTerms: true },
  });
  if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  const roomRes = await context.request.post(`${BASE}/api/rooms`, { data: { name: "Collab Room" } });
  if (!roomRes.ok()) throw new Error(`room create failed: ${roomRes.status()} ${await roomRes.text()}`);
  const room = (await roomRes.json()).room;
  const boardRes = await context.request.post(`${BASE}/api/rooms/${room.id}/boards`, { data: { name: "Collab Board" } });
  if (!boardRes.ok()) throw new Error(`board create failed: ${boardRes.status()} ${await boardRes.text()}`);
  const board = (await boardRes.json()).board;
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return { boardId: String(board.id), cookieHeader };
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

test("两个客户端通过 WebSocket + Redis pub/sub 在同一 Board channel 收发消息", async ({ browser }) => {
  const ctxA = await browser.newContext({ baseURL: BASE });
  const { boardId, cookieHeader } = await registerAndCreateBoard(ctxA);
  // 传输层测试的是同一 board 两条连接的中继，不测多用户权限模型（那是 F02+ 的范围）；
  // ctxB 复用 ctxA 的 session cookie，两条 WS 连接都合法访问同一个真实 board。
  const ctxB = await browser.newContext({ baseURL: BASE });
  const cookies = await ctxA.cookies();
  await ctxB.addCookies(cookies);
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
  const { boardId } = await registerAndCreateBoard(ctxA);
  const ctxB = await browser.newContext({ baseURL: BASE });
  await ctxB.addCookies(await ctxA.cookies());
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

test("未登录连接被拒绝：不带 session cookie 时 upgrade 返回 403，不会完成握手", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  try {
    const { boardId } = await registerAndCreateBoard(ctx);
    const result = await attemptUpgrade(boardId);
    expect(result.upgraded).toBe(false);
    expect(result.status).toBe(403);
  } finally {
    await ctx.close();
  }
});

test("已登录且是 board 归属者的连接被接受：带有效 session cookie 时 upgrade 返回 101", async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE });
  try {
    const { boardId, cookieHeader } = await registerAndCreateBoard(ctx);
    const result = await attemptUpgrade(boardId, cookieHeader);
    expect(result.upgraded).toBe(true);
    expect(result.status).toBe(101);
  } finally {
    await ctx.close();
  }
});

// 安全回归（review 修复核心）：已登录但对该 board 无权限的用户必须被拒绝——
// 此前的实现只验证"是否登录"，任何登录用户都能连进任意 board 的协作频道。
test("安全回归：已登录但非 board 成员的连接被拒绝，upgrade 返回 403", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const intruderCtx = await browser.newContext({ baseURL: BASE });
  try {
    const { boardId } = await registerAndCreateBoard(ownerCtx);
    // intruder 是完全不同的账号，从未加入 owner 的房间/白板。
    await intruderCtx.request.post(`${BASE}/api/auth/register`, {
      data: { firstName: "I", lastName: "N", email: uniq(), password: "secret123", agreeTerms: true },
    });
    const cookies = await intruderCtx.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const result = await attemptUpgrade(boardId, cookieHeader);
    expect(result.upgraded).toBe(false);
    expect(result.status).toBe(403);
  } finally {
    await ownerCtx.close();
    await intruderCtx.close();
  }
});
