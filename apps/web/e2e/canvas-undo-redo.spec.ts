import { test, expect } from "@playwright/test";
import { expectItemCount } from "./helpers/canvas";

// p6:F13：item 计数锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。

const uniq = () => `cur_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("撤销/重做 添加（Cmd/Ctrl+Z / +Shift+Z）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);

  await page.keyboard.press("ControlOrMeta+z");
  await expectItemCount(page, 0);
  // 落库一致：撤销后库里也没有
  expect((await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items.length).toBe(0);

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expectItemCount(page, 1);
  expect((await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items.length).toBe(1);
});

test("撤销 移动 → 回到原位（落库）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  const before = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0];

  // 单次移动是一条可逆命令（uc：逐步回退）；一次 ArrowRight ↔ 一次撤销
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].x).toBe(before.x + 1);

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].x).toBe(before.x);
});

test("撤销 删除 → 用原 id 还原（restore）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  const id0 = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].id;

  await page.keyboard.press("Delete");
  await expectItemCount(page, 0);

  await page.keyboard.press("ControlOrMeta+z");
  await expectItemCount(page, 1);
  const after = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items;
  expect(after.length).toBe(1);
  expect(after[0].id).toBe(id0); // 同 id 还原
});

test("撤销/重做 按钮", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  await page.getByTestId("undo").click();
  await expectItemCount(page, 0);
  await page.getByTestId("redo").click();
  await expectItemCount(page, 1);
});
