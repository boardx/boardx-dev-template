import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;

async function register(ctx: APIRequestContext, email: string) {
  const res = await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function createBoardPair(browser: { newContext(options: { baseURL: string }): Promise<BrowserContext> }) {
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  const emailA = uniq("syncA");
  const emailB = uniq("syncB");
  await register(ctxA.request, emailA);
  await register(ctxB.request, emailB);
  const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Realtime Sync" } })).json()).room;
  const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Items" } })).json()).board;
  const invite = await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });
  expect(invite.ok()).toBeTruthy();
  return { ctxA, ctxB, room, board };
}

const itemLocator = (page: Page) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

test("协作者通过实时通道看到组件创建、移动、编辑与删除", async ({ browser }) => {
  const { ctxA, ctxB, board } = await createBoardPair(browser);
  try {
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);
    await expect(itemLocator(pageA)).toHaveCount(0);
    await expect(itemLocator(pageB)).toHaveCount(0);

    await pageA.getByTestId("add-note").click();
    const noteA = itemLocator(pageA).first();
    const noteB = itemLocator(pageB).first();
    await expect(noteA).toBeVisible();
    await expect(noteB).toBeVisible({ timeout: 5_000 });
    await expect(noteB).toContainText("便签");

    await noteA.click();
    await pageA.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await noteB.evaluate((el) => (el as HTMLElement).style.left)), { timeout: 5_000 })
      .not.toBe("40px");

    await noteA.dblclick();
    await pageA.getByTestId(/^item-edit-/).fill("实时编辑");
    await pageA.keyboard.press("Enter");
    await expect(noteB).toContainText("实时编辑", { timeout: 5_000 });

    await noteA.click();
    await pageA.getByTestId("wm-delete").click();
    await expect(itemLocator(pageA)).toHaveCount(0);
    await expect(itemLocator(pageB)).toHaveCount(0, { timeout: 5_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("只读访问者可观察最新组件状态但不能编辑", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const viewerCtx = await browser.newContext({ baseURL: BASE });
  try {
    await register(ownerCtx.request, uniq("syncOwner"));
    const room = (await (await ownerCtx.request.post("/api/rooms", {
      data: { name: "Readonly Sync", visibility: "public" },
    })).json()).room;
    const board = (await (await ownerCtx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Viewer" } })).json()).board;
    const visibility = await ownerCtx.request.patch(`/api/boards/${board.id}/visibility`, {
      data: { visibility: "public" },
    });
    expect(visibility.ok()).toBeTruthy();

    await register(viewerCtx.request, uniq("syncViewer"));
    const ownerPage = await ownerCtx.newPage();
    const viewerPage = await viewerCtx.newPage();
    await ownerPage.goto(`/boards/${board.id}`);
    await viewerPage.goto(`/boards/${board.id}`);

    await expect(viewerPage.getByTestId("board-menu")).toBeHidden();
    await ownerPage.getByTestId("add-note").click();
    await expect(itemLocator(viewerPage)).toHaveCount(1, { timeout: 5_000 });

    const write = await viewerCtx.request.post(`/api/boards/${board.id}/items`, {
      data: { type: "note", x: 10, y: 10, text: "viewer write" },
    });
    expect(write.status()).toBe(403);
  } finally {
    await ownerCtx.close();
    await viewerCtx.close();
  }
});
