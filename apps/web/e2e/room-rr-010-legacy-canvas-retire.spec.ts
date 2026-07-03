import { test, expect } from "@playwright/test";

// uc-rr-009 / p20-F10：下线 legacy 单画布模型。
// 1) 旧直链 /rooms/[id]/board 重定向（3xx）到 /rooms/[id]/boards，而非 404；
// 2) legacy items API（/api/rooms/[id]/items 与 /api/items/[id]）全方法 410 Gone；
// 3) 新模型写路径全部带 board_id（DB 级 count=0 断言在 verification 的 psql 命令里）。
const uniq = () => `rr010_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newRoom(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return (await (await page.request.post("/api/rooms", { data: { name: "RR010" } })).json()).room;
}

test("旧画布页 /rooms/[id]/board → 重定向落到 /rooms/[id]/boards（非 404）", async ({ page }) => {
  const room = await newRoom(page);
  const resp = await page.goto(`/rooms/${room.id}/board`);
  expect(resp?.status()).toBe(200); // 跟随重定向后正常落地，不是 404
  await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}/boards$`));
  await expect(page.getByTestId("show-create-board")).toBeVisible(); // 落在 boards 列表页而非 404
});

test("旧画布页以 3xx 重定向完成（不是 404 兜底渲染）", async ({ page }) => {
  const room = await newRoom(page);
  const res = await page.request.get(`/rooms/${room.id}/board`, { maxRedirects: 0 });
  expect([301, 302, 307, 308]).toContain(res.status());
  expect(res.headers()["location"]).toContain(`/rooms/${room.id}/boards`);
});

test("legacy items API 全方法返回 410 Gone", async ({ page }) => {
  const room = await newRoom(page);
  const url = `/api/rooms/${room.id}/items`;
  expect((await page.request.get(url)).status()).toBe(410);
  expect((await page.request.post(url, { data: { type: "note", x: 1, y: 1 } })).status()).toBe(410);
  expect((await page.request.patch(url, { data: { text: "x" } })).status()).toBe(410);
  expect((await page.request.delete(url)).status()).toBe(410);
});

test("legacy 单条 item API /api/items/[id] 同样 410 Gone", async ({ page }) => {
  await newRoom(page);
  expect((await page.request.patch(`/api/items/legacy-id`, { data: { text: "x" } })).status()).toBe(410);
  expect((await page.request.delete(`/api/items/legacy-id`)).status()).toBe(410);
});

test("新模型写路径带 board_id：POST /api/boards/[id]/items 落库非空", async ({ page }) => {
  const room = await newRoom(page);
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Main board" } })).json()
  ).board;
  const res = await page.request.post(`/api/boards/${board.id}/items`, {
    data: { type: "note", x: 10, y: 10, text: "rr010" },
  });
  expect(res.status()).toBe(201);
  const { item } = await res.json();
  expect(item.board_id).not.toBeNull();
  expect(String(item.board_id)).toBe(String(board.id));
});
