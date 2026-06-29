import { test, expect } from "@playwright/test";

const uniq = () => `cpz_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
}

test("缩放控制条：放大/缩小/重置百分比", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("canvas-viewport")).toBeVisible();
  await expect(page.getByTestId("zoom-percent")).toHaveText("100%");

  await page.getByTestId("zoom-in").click();
  await expect(page.getByTestId("zoom-percent")).toHaveText("120%");
  await page.getByTestId("zoom-in").click();
  await expect(page.getByTestId("zoom-percent")).toHaveText("144%");

  await page.getByTestId("zoom-out").click();
  await expect(page.getByTestId("zoom-percent")).toHaveText("120%");

  await page.getByTestId("zoom-reset").click();
  await expect(page.getByTestId("zoom-percent")).toHaveText("100%");
});

test("小地图与画布表面渲染", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("minimap")).toBeVisible();
  await expect(page.getByTestId("minimap-viewport")).toBeVisible();
  await expect(page.getByTestId("canvas-surface")).toBeVisible();
});

test("拖拽平移改变画布表面 transform", async ({ page }) => {
  await openBoard(page);
  const surface = page.getByTestId("canvas-surface");
  const before = await surface.evaluate((el) => getComputedStyle(el).transform);
  const vp = page.getByTestId("canvas-viewport");
  const box = (await vp.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40);
  await page.mouse.up();
  const after = await surface.evaluate((el) => getComputedStyle(el).transform);
  expect(after).not.toBe(before);
});
