import { test, expect } from "@playwright/test";
import { canvasItems, clickItem, expectItemCount, waitForCanvasReady } from "./helpers/canvas";

// p6:F17：手绘组件（uc-widgets-006 + uc-board-menu-012）
// - 绘制：Board Menu「手绘」入口（board-tool-draw）激活 fabric 原生 isDrawingMode（PencilBrush），
//   在画布上按住拖动画笔，松开即把笔迹持久化为手绘组件。
// - 持久化：type:"note" 落库（服务端 validateNewItem 只放行 note/rect，白名单不可改），
//   color 头 "draw" 判别 + "|borderw=" 段承载线宽（复用 F19 既有段，不新增持久化列）；
//   笔迹点序列（相对包围盒左上角的局部坐标）JSON 存入既有 text 字段。刷新后仍在。
// - 橡皮擦：board-tool-eraser 激活擦除模式，点击某条笔迹删除整条笔迹（stroke 级删除）；
//   删除走既有 DELETE + recordOp 撤销栈，可撤销恢复。
// - 样式：Widget Menu 复用 wm-border/wm-border-width 表达笔色/线宽（同连接线的复用理由）；
//   手绘对象不展示色板（color 头是类型判别位）/字重/文本样式/文字色入口。

const uniq = () => `wdraw_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "D", lastName: "W", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Draw" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  return board;
}

// 在画布空白区域画一条笔迹（page.mouse down/move/up），返回落库后的手绘 item。
async function drawStroke(page: import("@playwright/test").Page, offsetX = 0) {
  await page.getByTestId("board-tool-draw").click();
  await expect(page.getByTestId("board-tool-draw")).toHaveAttribute("aria-pressed", "true");
  const box = await page.getByTestId("canvas-viewport").boundingBox();
  const sx = box!.x + 300 + offsetX;
  const sy = box!.y + 200;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 60, sy + 40, { steps: 10 });
  await page.mouse.move(sx + 120, sy + 10, { steps: 10 });
  await page.mouse.up();
  // 松开后异步持久化（POST + PATCH + load），等最终态落定：kind=draw 且 text（点序列 JSON）
  // 非空——POST 与 color PATCH 是两步异步，poll 避免读到中间态；系统高负载时窗口更长，给 20s。
  await expect
    .poll(
      async () => (await canvasItems(page)).filter((it) => it.kind === "draw" && it.text.length > 0).length,
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  const items = await canvasItems(page);
  return items.filter((it) => it.kind === "draw" && it.text.length > 0).at(-1)!;
}

test("画笔绘制 → 笔迹持久化为手绘组件（note + draw 哨兵 + 点序列 JSON），刷新后仍在", async ({ page }) => {
  const board = await openOwnBoard(page);

  const stroke = await drawStroke(page);
  expect(stroke.kind).toBe("draw");
  expect(stroke.color).toContain("draw");
  // text 字段存点序列 JSON
  const parsed = JSON.parse(stroke.text) as { points: [number, number][] };
  expect(Array.isArray(parsed.points)).toBe(true);
  expect(parsed.points.length).toBeGreaterThanOrEqual(2);

  // 服务端持久化：type 仍为 note（白名单只放行 note/rect），color 携带 draw 哨兵。
  const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
  const persisted = body.items.find((it: { id: string }) => it.id === stroke.id);
  expect(persisted.type).toBe("note");
  expect(String(persisted.color)).toContain("draw");

  // 刷新后笔迹仍在（端到端持久化闭环）。
  await page.reload();
  await expectItemCount(page, 1);
  const after = (await canvasItems(page))[0]!;
  expect(after.kind).toBe("draw");
  expect(after.id).toBe(stroke.id);
});

test("笔迹作为组件可选中、移动，Widget Menu 展示笔色/线宽入口（不展示色板/字重/文字色）", async ({ page }) => {
  await openOwnBoard(page);
  const stroke = await drawStroke(page);

  // 切回选择工具后点击笔迹选中。
  await page.getByTestId("board-tool-select").click();
  await clickItem(page, stroke.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("wm-border")).toBeVisible();
  await expect(page.getByTestId("wm-border-width")).toBeVisible();
  // 手绘对象不展示这些入口（color 头是类型判别位 / 无文字语义）。
  await expect(page.getByTestId("wm-color-amber")).toHaveCount(0);
  await expect(page.getByTestId("wm-bold")).toHaveCount(0);
  await expect(page.getByTestId("wm-textcolor")).toHaveCount(0);
  await expect(page.getByTestId("wm-font")).toHaveCount(0);

  // 改笔色 → 即时更新并持久化到 color 的 border 段。
  await page.getByTestId("wm-border").selectOption("blue");
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === stroke.id)!.border)
    .toBe("blue");

  // 拖拽移动笔迹。
  const rect = await page.evaluate((id) => window.__canvasTestApi!.getItemScreenRect(id), stroke.id);
  const cx = rect!.x + rect!.width / 2;
  const cy = rect!.y + rect!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 60, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === stroke.id)!.x)
    .not.toBe(stroke.x);
});

test("橡皮擦点击笔迹 → 删除该笔迹（stroke 级），撤销可恢复；不误删非笔迹组件", async ({ page }) => {
  await openOwnBoard(page);

  // 先放一张便利贴（橡皮擦不应删它），再画一条笔迹。
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  const stroke = await drawStroke(page);
  await expectItemCount(page, 2);

  // 橡皮擦模式：点击笔迹删除。
  await page.getByTestId("board-tool-eraser").click();
  await expect(page.getByTestId("board-tool-eraser")).toHaveAttribute("aria-pressed", "true");
  const rect = await page.evaluate((id) => window.__canvasTestApi!.getItemScreenRect(id), stroke.id);
  await page.mouse.click(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
  await expectItemCount(page, 1);
  expect((await canvasItems(page)).filter((it) => it.kind === "draw")).toHaveLength(0);

  // 橡皮擦点击便利贴：不删除（业务规则 4：橡皮擦只删除绘制内容）。
  const note = (await canvasItems(page))[0]!;
  const noteRect = await page.evaluate((id) => window.__canvasTestApi!.getItemScreenRect(id), note.id);
  await page.mouse.click(noteRect!.x + noteRect!.width / 2, noteRect!.y + noteRect!.height / 2);
  await expectItemCount(page, 1);

  // 撤销擦除 → 笔迹恢复（删除走 recordOp 撤销栈）。
  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("undo").click();
  await expectItemCount(page, 2);
  await expect
    .poll(async () => (await canvasItems(page)).filter((it) => it.kind === "draw").length)
    .toBe(1);
});

test("撤销绘制 → 笔迹消失；重做 → 恢复", async ({ page }) => {
  await openOwnBoard(page);
  await drawStroke(page);
  await expectItemCount(page, 1);

  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("undo").click();
  await expectItemCount(page, 0);

  await page.getByTestId("redo").click();
  await expectItemCount(page, 1);
  // redo 走 apiRestore（POST 还原 + PATCH 补 color 两步异步），poll 等 color 哨兵落定。
  await expect.poll(async () => (await canvasItems(page))[0]!.kind).toBe("draw");
});
