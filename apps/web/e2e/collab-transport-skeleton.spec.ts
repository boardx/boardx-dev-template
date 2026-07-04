import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;
const WS_PORT = process.env.COLLAB_WS_PORT ?? "3001";

const uniq = () => `collab_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// F01 要求 upgrade 时校验登录态：连接前先注册登录，让该 context 带上 session cookie
// （cookie 按 domain 匹配、不区分端口，浏览器会把它一并发给 ws://localhost:{WS_PORT}）。
async function login(context: BrowserContext) {
  await context.request.post(`${BASE}/api/auth/register`, {
    data: { firstName: "C", lastName: "D", email: uniq(), password: "secret123", agreeTerms: true },
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
  const boardId = `transport-${Date.now()}`;
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  await login(ctxA);
  await login(ctxB);
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
  const boardId = `transport-reconnect-${Date.now()}`;
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  await login(ctxA);
  await login(ctxB);
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

test("未登录连接被拒绝：不带 session cookie 时 upgrade 失败，不会收到 connected", async ({ browser }) => {
  const boardId = `transport-unauth-${Date.now()}`;
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  try {
    await page.goto("/api/health");
    // 刻意不 login()：这个 context 没有 session cookie，upgrade 应该被网关拒绝。
    await connect(page, wsUrl(boardId), "collab-unauth");
    const rejected = await page.waitForFunction(
      (eventName) => {
        const msgs = (window as any).__collabMessages?.[eventName] ?? [];
        if (msgs.some((m: any) => m.type === "connected")) throw new Error("unexpectedly connected");
        return (window as any).__collabWs?.readyState === WebSocket.CLOSED || msgs.some((m: any) => m.type === "error");
      },
      "collab-unauth",
      { timeout: 10_000 },
    );
    expect(await rejected.jsonValue()).toBeTruthy();
  } finally {
    await ctx.close();
  }
});
