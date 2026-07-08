import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { canvasItems, clickItem, expectItemCount, selectedIds, waitForCanvasReady } from "./helpers/canvas";

// p7:F14（uc-context-menu-001~004，issue #289）：右键 Context Menu 框架完善——
// 按目标显示允许的操作（空白画布级 vs 对象级 vs 锁定收窄）、复制/剪切/粘贴（复用 F08
// 剪贴板）、图层顺序（新增 "|z=" color 哨兵**持久化**，刷新后层序保持）、锁定/解锁
// （复用 p6:F20 toggleLocked）。编组/取消编组依赖 p6:F21（groupSelected），F21 尚未
// 合并到 main，入口留待接线（见 feature notes），本 spec 不覆盖编组。

const uniq = () => `cm14_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "C", lastName: "M", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Ctx14" } })).json())
    .board;
  // 预置「欢迎引导已关闭」标记，避免引导浮层拦截画布右键。
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  return board;
}

async function addNotes(page: Page, n: number) {
  for (let i = 0; i < n; i++) {
    await page.getByTestId("add-note").click();
    await expectItemCount(page, i + 1);
  }
}

// 按当前绘制顺序（z 升序）读 item id，数组末尾在最上层。
async function orderIds(page: Page): Promise<string[]> {
  return (await canvasItems(page)).map((it) => it.id);
}

// 画布空白处右键（视口右上角内缩点，避开 item 常驻区与小地图）。
async function rightClickBlank(page: Page) {
  const box = await page.getByTestId("canvas-viewport").boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width - 30, box!.y + 15, { button: "right" });
}

test("空白画布右键 → 画布级菜单：粘贴/选择所有，无对象级动作", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 2);
  await rightClickBlank(page);
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("ctx-paste")).toBeVisible();
  await expect(page.getByTestId("ctx-select-all")).toBeVisible();
  // 空白菜单不展示对象级动作（uc-001 备选流程 1）
  await expect(page.getByTestId("ctx-delete")).toHaveCount(0);
  await expect(page.getByTestId("ctx-cut")).toHaveCount(0);
  await expect(page.getByTestId("ctx-bring-front")).toHaveCount(0);
  // 剪贴板为空时粘贴不可用（uc-001 备选流程 2）
  await expect(page.getByTestId("ctx-paste")).toBeDisabled();
  // 选择所有 → 全部选中
  await page.getByTestId("ctx-select-all").click();
  await expect.poll(async () => (await selectedIds(page)).length).toBe(2);
});

test("对象右键 → 完整对象菜单；Esc 关闭且不执行动作", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 1);
  const id = (await orderIds(page))[0]!;
  await clickItem(page, id, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  for (const t of [
    "ctx-copy",
    "ctx-cut",
    "ctx-duplicate",
    "ctx-bring-front",
    "ctx-bring-forward",
    "ctx-send-backward",
    "ctx-send-back",
    "ctx-lock",
    "ctx-delete",
    "ctx-paste",
  ]) {
    await expect(page.getByTestId(t)).toBeVisible();
  }
  // Esc 关闭菜单，不执行任何动作（uc-001 主流程 7）
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("context-menu")).toHaveCount(0);
  await expectItemCount(page, 1);
});

test("剪切 → 对象移除进入待粘贴态；粘贴 → 内容重新出现（uc-002）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 1);
  const id = (await orderIds(page))[0]!;
  await clickItem(page, id, { button: "right" });
  await page.getByTestId("ctx-cut").click();
  await expectItemCount(page, 0);
  // 空白右键 → 粘贴可用 → 粘贴出剪切内容
  await rightClickBlank(page);
  await expect(page.getByTestId("ctx-paste")).toBeEnabled();
  await page.getByTestId("ctx-paste").click();
  await expectItemCount(page, 1);
  // 粘贴后的对象保持选中（uc-002 主流程 6）
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1);
});

test("图层顺序持久化：置顶后刷新页面，层序保持（z 哨兵落库）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const before = await orderIds(page); // [a, b, c]，c 最上层
  const a = before[0]!;
  await clickItem(page, a, { button: "right" });
  await page.getByTestId("ctx-bring-front").click();
  await expect.poll(async () => (await orderIds(page)).at(-1)).toBe(a);
  // z 已写入 color 哨兵（PATCH 落库），刷新后层序保持——这是 F14 相对旧版
  // 「仅本地数组重排、刷新即丢」的关键增量。
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === a)!.color ?? "", { timeout: 10_000 })
    .toContain("z=");
  await page.reload();
  await waitForCanvasReady(page);
  await expectItemCount(page, 3);
  expect((await orderIds(page)).at(-1)).toBe(a);
});

test("多选整体上移一层，保持选中项相对次序（uc-003 主流程 6）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 3);
  const [a, b, c] = (await orderIds(page)) as [string, string, string]; // [a,b,c]，c 最上层
  // 多选 a+b（Shift 点选）
  await clickItem(page, a);
  await clickItem(page, b, { shift: true });
  await expect.poll(async () => (await selectedIds(page)).length).toBe(2);
  await clickItem(page, b, { button: "right" });
  await page.getByTestId("ctx-bring-forward").click();
  // a、b 作为整体越过 c 一层，且 a 仍在 b 之下（相对次序不变）：新顺序 [c, a, b]
  await expect.poll(async () => orderIds(page)).toEqual([c, a, b]);
});

test("锁定对象右键 → 菜单收窄：保留复制与层级，隐藏剪切/副本/删除，显示解锁（uc-001/004）", async ({ page }) => {
  await openOwnBoard(page);
  await addNotes(page, 1);
  const id = (await orderIds(page))[0]!;
  // 通过右键菜单锁定（uc-004 主流程 5）
  await clickItem(page, id, { button: "right" });
  await page.getByTestId("ctx-lock").click();
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === id)!.locked, { timeout: 10_000 })
    .toBe(true);
  // 锁定后再右键 → 菜单收窄
  await clickItem(page, id, { button: "right" });
  await expect(page.getByTestId("context-menu")).toBeVisible();
  await expect(page.getByTestId("ctx-copy")).toBeVisible();
  await expect(page.getByTestId("ctx-bring-front")).toBeVisible(); // 层级保留（uc-001 前端入口 3）
  await expect(page.getByTestId("ctx-unlock")).toBeVisible();
  await expect(page.getByTestId("ctx-cut")).toHaveCount(0);
  await expect(page.getByTestId("ctx-duplicate")).toHaveCount(0);
  await expect(page.getByTestId("ctx-delete")).toHaveCount(0);
  // 解锁 → 恢复完整菜单（uc-004 主流程 6）
  await page.getByTestId("ctx-unlock").click();
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === id)!.locked, { timeout: 10_000 })
    .toBe(false);
  await clickItem(page, id, { button: "right" });
  await expect(page.getByTestId("ctx-delete")).toBeVisible();
  await expect(page.getByTestId("ctx-lock")).toBeVisible();
});
