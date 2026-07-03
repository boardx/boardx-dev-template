import { expect, test, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;
const WS_PORT = process.env.COLLAB_WS_PORT ?? "3001";

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
