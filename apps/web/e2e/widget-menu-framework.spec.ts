import { test, expect } from "@playwright/test";
import { expectItemCount } from "./helpers/canvas";

// p6:F13：item 计数锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。

const uniq = () => `wmf_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("选中时浮出 Widget Menu，取消选中隐藏", async ({ page }) => {
  await openOwnBoard(page);
  await expect(page.getByTestId("widget-menu")).toBeHidden();
  await page.getByTestId("add-note").click(); // 新建即选中
  await expect(page.getByTestId("widget-menu")).toBeVisible();
  await expect(page.getByTestId("wm-delete")).toBeVisible();
  await expect(page.getByTestId("wm-duplicate")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("widget-menu")).toBeHidden();
});

test("Widget Menu 删除选中", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  await page.getByTestId("wm-delete").click();
  await expectItemCount(page, 0);
  await expect(page.getByTestId("widget-menu")).toBeHidden();
});

test("Widget Menu 复制选中（出现副本）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await page.getByTestId("wm-duplicate").click();
  await expect.poll(async () => {
    return (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items.length;
  }).toBe(2);
});
