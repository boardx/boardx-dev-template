import { test, expect } from "@playwright/test";

// issue #584（#471/#529 阶段2 收尾）：地址栏统一用 public_id 形式（如 /boards/brd_xxx、
// /rooms/rm_xxx），不再暴露可枚举的自增整数。旧数字 URL 仍然可以直接访问（resolveBoardId/
// resolveRoomId 两种格式都认），但落地后客户端会把地址栏规范化成 public_id 形式
// （router.replace，不进历史栈），实现「旧书签不断链，新链接看不到数字」。

const uniq = () => `pidurl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndCreateRoomBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "P", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "PID Room" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "PID Board" } })).json()
  ).board;
  return { room, board };
}

test("新建白板/房间的 API 响应直接带 public_id（brd_/rm_ 前缀），不是自增整数", async ({ page }) => {
  const { room, board } = await registerAndCreateRoomBoard(page);
  expect(room.public_id).toMatch(/^rm_[0-9A-Za-z]{12}$/);
  expect(board.public_id).toMatch(/^brd_[0-9A-Za-z]{12}$/);
});

test("直接访问白板 → 地址栏是 public_id 形式（不是数字）", async ({ page }) => {
  const { board } = await registerAndCreateRoomBoard(page);
  await page.goto(`/boards/${board.id}`);
  await expect(page).toHaveURL(new RegExp(`/boards/${board.public_id}$`));
});

test("旧数字 URL 直接访问白板：不断链，落地后地址栏规范化到 public_id", async ({ page }) => {
  const { board } = await registerAndCreateRoomBoard(page);
  // 显式用数字 id 访问（模拟旧书签/别处残留的旧链接）。
  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-title")).toBeVisible();
  // 地址栏已经被规范化，不再停留在数字形式。
  await expect(page).toHaveURL(new RegExp(`/boards/${board.public_id}$`));
  await expect(page).not.toHaveURL(new RegExp(`/boards/${board.id}$`));
  // 刷新（此时 URL 已经是 public_id 形式）依然正常打开，不是重复跳转/死循环。
  await page.reload();
  await expect(page.getByTestId("board-title")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/boards/${board.public_id}$`));
});

test("旧数字 URL 直接访问房间：地址栏规范化到 public_id，当前 tab 保留", async ({ page }) => {
  const { room } = await registerAndCreateRoomBoard(page);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("room-header-name")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/rooms/${room.public_id}/members$`));
});

test("Room boards 列表页卡片链接直接是 public_id（不是先落地数字再跳）", async ({ page }) => {
  const { room, board } = await registerAndCreateRoomBoard(page);
  await page.goto(`/rooms/${room.id}/boards`);
  const card = page.getByTestId(`board-${board.id}`);
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/boards/${board.public_id}$`));
});

test("分享链接（QR/复制）用 public_id 形式，不暴露数字 id", async ({ page }) => {
  const { board } = await registerAndCreateRoomBoard(page);
  await page.goto(`/boards/${board.public_id}`);
  await page.getByTestId("board-share").click();
  const shareInput = page.getByTestId("share-url");
  await expect(shareInput).toHaveValue(new RegExp(`/boards/${board.public_id}$`));
});
