import { test, expect } from "@playwright/test";
import { waitForItem } from "./helpers/canvas";

// p20-F10：legacy 单画布下线后，本 spec 迁移到 board 模型
// （先建板 → API 预置 item → 画布页 /boards/[id] 渲染）。
// 注：p20 合并时用了 p6:F13（渲染引擎切 fabric.Canvas）之前的 DOM 断言（item-<id> testid），
// 该 DOM 节点在 fabric 渲染下不再产出。按策略 2（issue #269）改为 canvas 兼容锚点。
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
  // issue #333：waitForCanvasReady 只等引擎就绪，不等首次 items 拉取；改用带重试的
  // waitForItem（断言意图不变：预置 item 出现在渲染层且文字正确）。
  const rendered = await waitForItem(page, item.id);
  expect(rendered.text).toContain("已有便签");
});
