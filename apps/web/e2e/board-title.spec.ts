import { expect, test } from "@playwright/test";
import { waitForCanvasReady } from "./helpers/canvas";

// p7:F02（uc-board-header-002）：Header 标题查看与编辑。
const uniq = () => `bt_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createRoomAndBoard(page: import("@playwright/test").Page, boardName = "Title Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Title Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: boardName } })).json())
    .board;
  return { room, board };
}

test("owner 点击标题 → 进入编辑 → 回车保存新标题", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-title").click();
  const input = page.getByTestId("board-title-input");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("Title Board");
  await input.fill("Renamed Board");
  await input.press("Enter");

  await expect(page.getByTestId("board-title")).toHaveText("Renamed Board");
  await expect(page.getByTestId("board-title-input")).toHaveCount(0);

  // 刷新后仍生效，确认真落库而非只是本地乐观显示。
  await page.reload();
  await waitForCanvasReady(page);
  await expect(page.getByTestId("board-title")).toHaveText("Renamed Board");
});

test("失焦（点击其它区域）也会保存", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-title").click();
  await page.getByTestId("board-title-input").fill("Blurred Save");
  await page.getByTestId("board-role").click();

  await expect(page.getByTestId("board-title")).toHaveText("Blurred Save");
});

test("清空标题后失焦：恢复为保存前的名称，不保存空名", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-title").click();
  await page.getByTestId("board-title-input").fill("");
  await page.getByTestId("board-role").click();

  await expect(page.getByTestId("board-title")).toHaveText("Title Board");
});

test("Escape 取消编辑，不保存草稿", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-title").click();
  await page.getByTestId("board-title-input").fill("Should Not Save");
  await page.getByTestId("board-title-input").press("Escape");

  await expect(page.getByTestId("board-title-input")).toHaveCount(0);
  await expect(page.getByTestId("board-title")).toHaveText("Title Board");
});

test("viewer 无管理权限：标题不可点击进入编辑", async ({ page, playwright }) => {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Viewer Title Room" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Viewer Title Board" } })).json())
    .board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-title").click();
  await expect(page.getByTestId("board-title-input")).toHaveCount(0);

  await owner.dispose();
});
