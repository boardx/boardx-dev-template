import { test, expect } from "@playwright/test";

// uc-board-menu-003-create-text：在画布创建文本（Text）组件。
// 复用便签的选择/拖拽/双击编辑/删除/撤销重做机制；文本以透明无边框文本块渲染。
const uniq = () => `bm003_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

const items = (page: any) => page.getByTestId("items-layer").locator('[data-testid^="item-"]');

test("添加文本 → 画布出现文本组件并自动选中", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("add-text").click();
  await expect(items(page)).toHaveCount(1);
  // 创建即自动选中（已选 1）
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  // 默认文本可见
  await expect(items(page).first()).toContainText("文本");
});

test("双击文本组件 → 编辑文字并持久化（刷新仍在）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await expect(items(page)).toHaveCount(1);
  const id = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].id;

  await page.getByTestId(`item-${id}`).dblclick();
  const editor = page.getByTestId(`item-edit-${id}`);
  await expect(editor).toBeVisible();
  await editor.fill("标题文本 Title");
  await editor.blur();

  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].text)
    .toBe("标题文本 Title");

  // 刷新后保留（含文本 color 哨兵 → 仍是文本块）
  await page.reload();
  await expect(page.getByTestId(`item-${id}`)).toContainText("标题文本 Title");
});

test("文本与便签共存：add-note 仍可用", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await expect(items(page)).toHaveCount(1);
  await page.getByTestId("add-note").click();
  await expect(items(page)).toHaveCount(2);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});
