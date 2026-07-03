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

async function createMemberBoard(
  browser: { newContext(options: { baseURL: string }): Promise<BrowserContext> },
  prefix: string,
) {
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  const emailA = uniq(`${prefix}A`);
  const emailB = uniq(`${prefix}B`);
  await register(ctxA.request, emailA, "Ava", "Owner");
  await register(ctxB.request, emailB, "Ben", "Editor");
  const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Presence" } })).json()).room;
  const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Cursors" } })).json()).board;
  const invite = await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });
  expect(invite.ok()).toBeTruthy();
  return { ctxA, ctxB, room, board };
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
  await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.4, { steps: 5 });
}

test("在线成员头像当前用户优先，协作者实时看到远端光标并在空闲后隐藏", async ({ browser }) => {
  const { ctxA, ctxB, board } = await createMemberBoard(browser, "cursorPair");
  try {
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);

    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });
    await expect(pageB.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });

    const aId = await selfId(pageA);
    await expect(pageA.getByTestId("presence-member").first()).toHaveAttribute("data-self", "true");
    await expect(pageB.getByTestId("presence-member").first()).toHaveAttribute("data-self", "true");

    await moveInsideCanvas(pageA);
    await expect(pageB.getByTestId(`collab-cursor-${aId}`)).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByTestId(`collab-cursor-label-${aId}`)).toContainText("Ava Owner");

    await pageA.mouse.move(5, 5);
    await expect(pageB.getByTestId(`collab-cursor-${aId}`)).toBeHidden({ timeout: 15_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("头像溢出列表可展开，只读访问者能观察 presence/cursor 但不能编辑", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const editorCtx = await browser.newContext({ baseURL: BASE });
  const viewerCtx = await browser.newContext({ baseURL: BASE });
  const extraContexts: BrowserContext[] = [];
  try {
    await register(ownerCtx.request, uniq("cursorOwner"), "Owner", "User");
    const editorEmail = uniq("cursorEditor");
    await register(editorCtx.request, editorEmail, "Editor", "User");
    await register(viewerCtx.request, uniq("cursorViewer"), "Viewer", "User");
    const room = (await (await ownerCtx.request.post("/api/rooms", {
      data: { name: "Readonly Presence", visibility: "public" },
    })).json()).room;
    const board = (await (await ownerCtx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Public" } })).json()).board;
    const visibility = await ownerCtx.request.patch(`/api/boards/${board.id}/visibility`, {
      data: { visibility: "public" },
    });
    expect(visibility.ok()).toBeTruthy();
    const invite = await ownerCtx.request.post(`/api/rooms/${room.id}/members`, {
      data: { email: editorEmail },
    });
    expect(invite.ok()).toBeTruthy();

    const ownerPage = await ownerCtx.newPage();
    const editorPage = await editorCtx.newPage();
    const viewerPage = await viewerCtx.newPage();
    await ownerPage.goto(`/boards/${board.id}`);
    await editorPage.goto(`/boards/${board.id}`);
    await viewerPage.goto(`/boards/${board.id}`);

    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ baseURL: BASE });
      extraContexts.push(ctx);
      await register(ctx.request, uniq(`cursorExtra${i}`), `Extra${i}`, "User");
      await (await ctx.newPage()).goto(`/boards/${board.id}`);
    }

    await expect(ownerPage.getByTestId("board-presence")).toHaveAttribute("data-online-count", "6", { timeout: 20_000 });
    await ownerPage.getByTestId("presence-overflow").click();
    await expect(ownerPage.getByTestId("presence-list")).toBeVisible();
    await expect(ownerPage.getByTestId("presence-list-member")).toHaveCount(2);

    await expect(viewerPage.getByTestId("board-menu")).toBeHidden();
    const ownerId = await selfId(ownerPage);
    await moveInsideCanvas(ownerPage);
    await expect(viewerPage.getByTestId(`collab-cursor-${ownerId}`)).toBeVisible({ timeout: 15_000 });

    const write = await viewerCtx.request.post(`/api/boards/${board.id}/items`, {
      data: { type: "note", x: 10, y: 10, text: "viewer write" },
    });
    expect(write.status()).toBe(403);
  } finally {
    await ownerCtx.close();
    await editorCtx.close();
    await viewerCtx.close();
    await Promise.all(extraContexts.map((ctx) => ctx.close()));
  }
});
