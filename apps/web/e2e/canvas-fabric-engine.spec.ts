import { test, expect } from "@playwright/test";
import { waitForCanvasReady, canvasItems, expectItemCount } from "./helpers/canvas";

// p6:F13 渲染引擎切换 Fabric.js：页面存在承载渲染的 <canvas> 元素，
// 且 fabric 对象数与渲染层 items 数一致（真实切换，非 DOM 假渲染）。
const uniq = () => `cfe_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "F", lastName: "E", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Fabric" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Engine" } })).json()).board;
  return board;
}

test("画布由 <canvas>（fabric）渲染，fabric 对象数与 items 一致", async ({ page }) => {
  const board = await openOwnBoard(page);
  // 预置两个 item（API 落库），页面加载后应全部渲染为 fabric 对象。
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 40, y: 40, text: "便签一" } });
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "rect", x: 260, y: 40, text: "" } });

  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  // 承载渲染的 <canvas> 存在于画布视口内（fabric 生成 lower/upper 两层 canvas）。
  const canvases = page.getByTestId("canvas-viewport").locator("canvas");
  await expect(canvases.first()).toBeVisible();
  expect(await canvases.count()).toBeGreaterThanOrEqual(1);

  // 渲染引擎标识 + items 全部进入渲染层。
  expect(await page.evaluate(() => window.__canvasTestApi!.engine)).toBe("fabric");
  await expectItemCount(page, 2);

  // fabric 对象数与 items 数一致（每个 item 对应一个 fabric 对象）。
  await expect
    .poll(async () =>
      page.evaluate(() => window.__canvasTestApi!.getFabricObjectCount()),
    )
    .toBe(2);

  // item 的坐标/文本经渲染层可读（供其余 spec 的 canvas 兼容锚点使用）。
  const items = await canvasItems(page);
  const note = items.find((it) => it.type === "note")!;
  expect(note.text).toBe("便签一");
  expect(note.x).toBe(40);
  expect(note.y).toBe(40);

  // 新增一个 item → fabric 对象数同步增长。
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 3);
  await expect
    .poll(async () => page.evaluate(() => window.__canvasTestApi!.getFabricObjectCount()))
    .toBe(3);
});
