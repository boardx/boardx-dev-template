import { test, expect } from "@playwright/test";
import { canvasItems, dblclickItem, expectItemCount } from "./helpers/canvas";

// p6:F13：item 锚点迁为 canvas 兼容锚点（策略 2 / issue #269）：双击 → 屏幕坐标 dblclick，
// 文本可见性 → 渲染层 getItems().text。编辑框（item-edit-<id>）仍是 DOM 覆盖层，锚点不变。

const uniq = () => `wst_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("双击便签编辑文字并持久化", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  const id = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].id;

  await dblclickItem(page, id);
  const editor = page.getByTestId(`item-edit-${id}`);
  await expect(editor).toBeVisible();
  await editor.fill("Hello 计划");
  await editor.blur();

  await expect.poll(async () => {
    return (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].text;
  }).toBe("Hello 计划");
  // 刷新后保留（渲染层文本一致）
  await page.reload();
  await expectItemCount(page, 1);
  expect((await canvasItems(page))[0]!.text).toBe("Hello 计划");
});

test("Widget Menu 改便签颜色并持久化", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  await page.getByTestId("wm-color-blue").click();
  await expect.poll(async () => {
    return (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].color;
  }).toBe("blue");
});

test("viewer 不能编辑（双击无编辑框）", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  const item = (await (await owner.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 40, y: 40, text: "x" } })).json()).item;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);
  await expectItemCount(page, 1);
  await dblclickItem(page, item.id);
  await expect(page.getByTestId(`item-edit-${item.id}`)).toHaveCount(0);
  await owner.dispose();
});
