import { expect, test } from "@playwright/test";
import { waitForCanvasReady } from "./helpers/canvas";

// p7:F06（uc-board-header-014）：Board 统计信息。
const uniq = () => `stat_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createRoomAndBoard(page: import("@playwright/test").Page, boardName = "Stats Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Stats Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: boardName } })).json())
    .board;
  return { room, board };
}

test("打开统计面板：组件按类型分类计数 + 协作者数 + 最近创建时间", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  // 便签 x2、形状 x1
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 10, y: 10, text: "a" } });
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 20, y: 20, text: "b" } });
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "rect", x: 30, y: 30, text: "矩形" } });

  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-stats-open").click();
  await expect(page.getByTestId("board-stats-panel")).toBeVisible();
  await expect(page.getByTestId("stat-total")).toHaveText("3");
  await expect(page.getByTestId("stat-notes")).toHaveText("2");
  await expect(page.getByTestId("stat-texts")).toHaveText("0");
  await expect(page.getByTestId("stat-shapes")).toHaveText("1");
  await expect(page.getByTestId("stat-connectors")).toHaveText("0");
  // 房间只有 owner 一个成员（自己创建，未邀请其它人）。
  await expect(page.getByTestId("stat-members")).toHaveText("1");
  await expect(page.getByTestId("stat-last-created")).not.toHaveText("暂无组件");
});

test("空白板：统计为 0，最近创建显示暂无组件", async ({ page }) => {
  const { board } = await createRoomAndBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("board-stats-open").click();
  await expect(page.getByTestId("stat-total")).toHaveText("0");
  await expect(page.getByTestId("stat-last-created")).toHaveText("暂无组件");
});

test("统计接口对无权限用户 403", async ({ page, playwright }) => {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Private Stats Room" } })).json()).room;
  const board = (
    await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Private Stats Board" } })).json()
  ).board;

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.get(`/api/boards/${board.id}/statistics`);
  expect(res.status()).toBe(403);

  await owner.dispose();
});
