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

async function viewport(page: Page) {
  const surface = page.getByTestId("canvas-surface");
  return {
    tx: await surface.getAttribute("data-vp-tx"),
    ty: await surface.getAttribute("data-vp-ty"),
    scale: await surface.getAttribute("data-vp-scale"),
  };
}

async function panOwner(page: Page, dx: number, dy: number) {
  const box = await page.getByTestId("canvas-viewport").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 420, box!.y + 280);
  await page.mouse.down();
  await page.mouse.move(box!.x + 420 + dx, box!.y + 280 + dy, { steps: 5 });
  await page.mouse.up();
}

async function expectViewportToMatch(page: Page, expected: { tx: string | null; ty: string | null; scale: string | null }) {
  await expect(page.getByTestId("canvas-surface")).toHaveAttribute("data-vp-scale", expected.scale!, { timeout: 15_000 });
  await expect(page.getByTestId("canvas-surface")).toHaveAttribute("data-vp-tx", expected.tx!, { timeout: 15_000 });
  await expect(page.getByTestId("canvas-surface")).toHaveAttribute("data-vp-ty", expected.ty!, { timeout: 15_000 });
}

test("跟随协作者视角可暂停、恢复、停止，主动操作会暂停", async ({ browser }) => {
  const ownerCtx: BrowserContext = await browser.newContext({ baseURL: BASE });
  const editorCtx: BrowserContext = await browser.newContext({ baseURL: BASE });
  const viewerCtx: BrowserContext = await browser.newContext({ baseURL: BASE });
  try {
    const ownerEmail = uniq("followOwner");
    const editorEmail = uniq("followEditor");
    await register(ownerCtx.request, ownerEmail, "Follow", "Owner");
    await register(editorCtx.request, editorEmail, "Follow", "Editor");
    await register(viewerCtx.request, uniq("followViewer"), "Follow", "Viewer");

    const room = (await (await ownerCtx.request.post("/api/rooms", {
      data: { name: "Follow Room", visibility: "public" },
    })).json()).room;
    const board = (await (await ownerCtx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Follow Board" } })).json()).board;
    const visibility = await ownerCtx.request.patch(`/api/boards/${board.id}/visibility`, {
      data: { visibility: "public" },
    });
    expect(visibility.ok()).toBeTruthy();
    const invite = await ownerCtx.request.post(`/api/rooms/${room.id}/members`, { data: { email: editorEmail } });
    expect(invite.ok()).toBeTruthy();

    const ownerPage = await ownerCtx.newPage();
    const editorPage = await editorCtx.newPage();
    const viewerPage = await viewerCtx.newPage();
    await ownerPage.goto(`/boards/${board.id}`);
    await editorPage.goto(`/boards/${board.id}`);
    await viewerPage.goto(`/boards/${board.id}`);

    await expect(ownerPage.getByTestId("board-presence")).toHaveAttribute("data-online-count", "3", { timeout: 20_000 });
    await expect(editorPage.getByTestId("board-presence")).toHaveAttribute("data-online-count", "3", { timeout: 20_000 });
    await expect(viewerPage.getByTestId("board-presence")).toHaveAttribute("data-online-count", "3", { timeout: 20_000 });

    const ownerId = await selfId(ownerPage);

    await editorPage.getByTestId(`follow-${ownerId}`).click();
    await expect(editorPage.getByTestId("following-banner")).toHaveAttribute("data-follow-state", "active");
    await expect(editorPage.getByTestId("canvas-surface")).toHaveAttribute("data-following", "true");
    await expect(ownerPage.getByTestId("followed-by-banner")).toContainText("Follow Editor", { timeout: 15_000 });

    await ownerPage.getByTestId("zoom-in").click();
    await ownerPage.getByTestId("zoom-in").click();
    await panOwner(ownerPage, 90, 70);
    const ownerVp = await viewport(ownerPage);
    await expectViewportToMatch(editorPage, ownerVp);

    await editorPage.getByTestId("pause-following").click();
    await expect(editorPage.getByTestId("following-banner")).toHaveAttribute("data-follow-state", "paused");
    await expect(editorPage.getByTestId("canvas-surface")).toHaveAttribute("data-following", "false");
    const pausedVp = await viewport(editorPage);

    await ownerPage.getByTestId("zoom-in").click();
    await panOwner(ownerPage, 70, 40);
    await expect
      .poll(async () => await viewport(editorPage), { timeout: 3_000 })
      .toEqual(pausedVp);

    await editorPage.getByTestId("resume-following").click();
    await expect(editorPage.getByTestId("following-banner")).toHaveAttribute("data-follow-state", "active");
    await expectViewportToMatch(editorPage, await viewport(ownerPage));

    await editorPage.getByTestId("zoom-out").click();
    await expect(editorPage.getByTestId("following-banner")).toHaveAttribute("data-follow-state", "paused");
    await expect(editorPage.getByTestId("canvas-surface")).toHaveAttribute("data-following", "false");

    await editorPage.getByTestId("resume-following").click();
    await expect(editorPage.getByTestId("following-banner")).toHaveAttribute("data-follow-state", "active");
    await editorPage.getByTestId("stop-following").click();
    await expect(editorPage.getByTestId("following-banner")).toBeHidden();
    await expect(editorPage.getByTestId("canvas-surface")).toHaveAttribute("data-following", "false");

    await expect(viewerPage.getByTestId("board-menu")).toBeHidden();
    await viewerPage.getByTestId(`follow-${ownerId}`).click();
    await expect(viewerPage.getByTestId("following-banner")).toHaveAttribute("data-follow-state", "active");
    const write = await viewerCtx.request.post(`/api/boards/${board.id}/items`, {
      data: { type: "note", x: 10, y: 10, text: "viewer write" },
    });
    expect(write.status()).toBe(403);
  } finally {
    await ownerCtx.close();
    await editorCtx.close();
    await viewerCtx.close();
  }
});
