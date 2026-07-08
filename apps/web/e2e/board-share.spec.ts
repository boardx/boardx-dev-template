import { expect, test } from "@playwright/test";
import { waitForCanvasReady } from "./helpers/canvas";

// p7:F03（uc-board-header-003）：分享 Board（链接 / 二维码 / 访问范围）。
const uniq = () => `bs_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createRoomAndBoard(page: import("@playwright/test").Page, boardName = "Share Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Share Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: boardName } })).json())
    .board;
  return { room, board };
}

test("owner（房间 owner）打开分享面板：访问范围/复制链接/二维码均可用", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-share").click();
  const panel = page.getByTestId("share-panel");
  await expect(panel).toBeVisible();

  const visibility = page.getByTestId("share-visibility");
  await expect(visibility).toBeEnabled();
  await expect(visibility).toHaveValue("room");

  await expect(page.getByTestId("share-url")).toHaveValue(new RegExp(`/boards/${board.id}$`));
  await page.getByTestId("share-copy").click();
  await expect(page.getByTestId("share-copy-status")).toHaveText("已复制到剪贴板");

  await page.getByTestId("share-qr-toggle").click();
  const qr = page.getByTestId("share-qr");
  await expect(qr).toBeVisible();
  await expect(qr).toHaveJSProperty("tagName", "IMG");
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);

  await page.getByTestId("share-qr-toggle").click();
  await expect(page.getByTestId("share-qr")).toHaveCount(0);
});

test("owner 切换访问范围为公开，面板立即反映新值", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-share").click();
  await page.getByTestId("share-visibility").selectOption("public");
  await expect(page.getByTestId("share-visibility")).toHaveValue("public");

  // 刷新后仍生效，确认真落库。
  await page.reload();
  await waitForCanvasReady(page);
  await page.getByTestId("board-share").click();
  await expect(page.getByTestId("share-visibility")).toHaveValue("public");
});

test("非房间 owner/admin：访问范围下拉框禁用，但仍可查看当前值、复制链接、看二维码", async ({
  page,
  playwright,
}) => {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Share Member Room" } })).json()).room;
  const board = (
    await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Share Member Board" } })).json()
  ).board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-share").click();
  const visibility = page.getByTestId("share-visibility");
  await expect(visibility).toBeDisabled();
  await expect(visibility).toHaveValue("public");
  await expect(page.getByTestId("share-url")).toBeVisible();
  await expect(page.getByTestId("share-copy")).toBeEnabled();

  await owner.dispose();
});
