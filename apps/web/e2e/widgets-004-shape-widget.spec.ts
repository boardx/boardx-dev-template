import { test, expect } from "@playwright/test";
import { expectItemCount } from "./helpers/canvas";

// p6:F13：item 计数锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。
// 注：add-shape 入口在本分支基线即缺失（main 的 F01 锚点），该失败原样保留。

const uniq = () => `shp_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "H", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Shapes" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("添加形状（rect）→ 出现在板上、自动选中、刷新仍在", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-shape").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  // 服务端以原生 rect 落库
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].type)
    .toBe("rect");

  // 刷新仍在
  await page.reload();
  await expectItemCount(page, 1);
});

test("形状与便签共存：add-note 仍工作", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-shape").click();
  await expectItemCount(page, 2);
});
