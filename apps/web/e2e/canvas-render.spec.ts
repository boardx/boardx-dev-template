import { test, expect } from "@playwright/test";

// p20-F10：legacy 单画布下线后，本 spec 迁移到 board 模型
// （先建板 → API 预置 item → 画布页 /boards/[id] 渲染）。
const uniq = () => `cr_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("打开白板画布，渲染已有 item", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Board Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  const item = (await (await page.request.post(`/api/boards/${board.id}/items`, {
    data: { type: "note", x: 30, y: 40, text: "已有便签" },
  })).json()).item;

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible();
  await expect(page.getByTestId(`item-${item.id}`)).toContainText("已有便签");
});
