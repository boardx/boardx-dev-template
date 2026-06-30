import { test, expect } from "@playwright/test";

const uniq = () => `ccp_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("Cmd/Ctrl+C 复制 + V 粘贴出偏移副本并选中", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");

  // 画布上变成 2 个 item，粘贴的新副本被选中（已选 1）
  const items = page.getByTestId("items-layer").locator('[data-testid^="item-"]');
  await expect(items).toHaveCount(2);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  // 落库：board 有 2 个 item，副本带偏移
  const all = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items;
  expect(all.length).toBe(2);
  expect(all[0].x).not.toBe(all[1].x);
});

test("多选批量复制粘贴", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-note").click();
  // 等两个 item 都落地再全选（避免 Ctrl+A 读到尚未 load 刷新的 items）
  await expect(page.getByTestId("items-layer").locator('[data-testid^="item-"]')).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+a");
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");

  await expect.poll(async () => {
    return (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items.length;
  }).toBe(4);
});
