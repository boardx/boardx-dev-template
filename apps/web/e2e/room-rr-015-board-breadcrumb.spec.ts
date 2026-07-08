// p22/F04 Board 详情页面包屑回退至所属房间（uc 见 requirements/00-overview.md 优先级3）
// 契约：/boards/[id] 页头展示返回链接指回所属房间的 Boards tab；点击正确导航。
//
// 发现记录：rebase 到最新 main 后发现 p7:F01（uc-board-header-008，Board Menu 工具栏框架）
// 已经实现了几乎相同的能力——`data-testid="board-back"` 按钮，`router.push` 到
// `/rooms/${room_id}/boards`（无 room_id 兜底 `/boards`）。本 feature 原计划新增的
// `board-back-to-room` Link 与其功能完全重复，已删除，直接对既有的 board-back 补验证契约，
// 不重复造轮子。
import { test, expect, type Page } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page, prefix: string): Promise<string> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return email;
}

async function createRoom(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  const d = await res.json();
  return d.room.id as number;
}

async function createBoard(page: Page, roomId: number, name: string): Promise<number> {
  const res = await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name } });
  const d = await res.json();
  return d.board.id as number;
}

test("打开房间白板：页头展示返回按钮，点击回到所属房间 Boards tab", async ({ page }) => {
  await register(page, "boardbc1");
  const roomId = await createRoom(page, "Breadcrumb Room");
  const boardId = await createBoard(page, roomId, "Test Board");

  await page.goto(`/boards/${boardId}`);
  await expect(page.getByTestId("board-back")).toBeVisible();
  await page.getByTestId("board-back").click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/boards$`), { timeout: 20000 });
});
