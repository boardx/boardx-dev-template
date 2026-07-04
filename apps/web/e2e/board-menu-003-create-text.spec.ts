import { test, expect } from "@playwright/test";
import { canvasItems, dblclickItem, expectItemCount } from "./helpers/canvas";

// p6:F13：item 锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。

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

test("添加文本 → 画布出现文本组件并自动选中", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("add-text").click();
  await expectItemCount(page, 1);
  // 创建即自动选中（已选 1）
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  // 默认文本可见（渲染层文本）
  expect((await canvasItems(page))[0]!.text).toContain("文本");
});

test("双击文本组件 → 编辑文字并持久化（刷新仍在）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await expectItemCount(page, 1);
  const id = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].id;

  await dblclickItem(page, id);
  const editor = page.getByTestId(`item-edit-${id}`);
  await expect(editor).toBeVisible();
  await editor.fill("标题文本 Title");
  await editor.blur();

  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].text)
    .toBe("标题文本 Title");

  // 刷新后保留（含文本 color 哨兵 → 仍是文本块）
  await page.reload();
  await expectItemCount(page, 1);
  const it = (await canvasItems(page))[0]!;
  expect(it.text).toBe("标题文本 Title");
  expect((it.color ?? "").split(":")[0]).toBe("text");
});

test("文本与便签共存：add-note 仍可用", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await expectItemCount(page, 1);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 2);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});
