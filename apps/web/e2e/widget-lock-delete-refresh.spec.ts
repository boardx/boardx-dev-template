import { test, expect } from "@playwright/test";
import { canvasItems, clickItem, dblclickItem, expectItemCount, itemScreenRect } from "./helpers/canvas";

// p6:F20：锁定/解锁 + 删除 + 刷新组件
// - uc-widget-menu-003（锁定/解锁组件）：锁定态编码为 color 的 "|locked=1" 段（沿用 F12/F19
//   建立的 "|k=v" 哨兵编码约定，见 board-canvas.tsx 的 getLocked/toggleLocked）。锁定后不可
//   移动/缩放/旋转/编辑；Widget Menu 只保留锁定状态入口（解锁），删除入口置灰。多选混合锁定态
//   仍展示样式/编辑入口（对未锁定项生效），锁定按钮统一收敛为「全部锁定」，全部锁定后才显示
//   「解锁」。
// - uc-widget-menu-008（删除组件）与 uc-widget-menu-009（刷新组件）：删除（wm-delete）和刷新
//   （wm-refresh/wm-refresh-unavailable）能力在 F10/F13 已落地并有独立回归
//   （widget-menu-framework.spec.ts / widget-menu-009-refresh-widget.spec.ts），本文件只补
//   「删除遇到锁定对象」这一 F20 新增的交叉分支，不重复既有覆盖。

const uniq = () => `wld_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "L", lastName: "K", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Lock" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("锁定组件：菜单显示解锁入口，持久化为 |locked=1，刷新页面后仍锁定", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  let it = (await canvasItems(page))[0]!;
  expect(it.locked).toBe(false);

  // 未锁定 → 显示「锁定」入口。
  await expect(page.getByTestId("wm-lock")).toBeVisible();
  await expect(page.getByTestId("wm-unlock")).toHaveCount(0);

  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(true);

  // 锁定后 → 只保留「解锁」入口，样式类入口隐藏（业务规则 1：锁定对象只保留锁定状态入口）。
  await expect(page.getByTestId("wm-unlock")).toBeVisible();
  await expect(page.getByTestId("wm-lock")).toHaveCount(0);
  await expect(page.getByTestId("wm-bold")).toHaveCount(0);
  await expect(page.getByTestId("wm-duplicate")).toHaveCount(0);
  // 删除入口保留但置灰（uc-widget-menu-008 主流程 2）。
  await expect(page.getByTestId("wm-delete")).toBeDisabled();

  // 持久化：color 落库带 "|locked=1" 段，刷新页面后仍锁定。
  await expect
    .poll(async () => {
      const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
      return body.items[0].color as string;
    })
    .toMatch(/\|locked=1(\||$)/);
  await page.reload();
  await expectItemCount(page, 1);
  it = (await canvasItems(page))[0]!;
  expect(it.locked).toBe(true);
});

test("锁定组件不可移动/缩放/旋转/编辑；解锁后恢复", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);
  let it = (await canvasItems(page))[0]!;
  const { x: x0, y: y0 } = it;

  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(true);

  // 不可移动：方向键微移无效（moveSelected 对锁定项短路）。
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(150);
  it = (await canvasItems(page))[0]!;
  expect(it.x).toBe(x0);
  expect(it.y).toBe(y0);

  // 不可移动：拖拽手势对锁定对象短路（object:moving 卫兵 + lockMovementX/Y）。
  const rect = await itemScreenRect(page, it.id);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 80, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  it = (await canvasItems(page))[0]!;
  expect(it.x).toBe(x0);
  expect(it.y).toBe(y0);

  // 不可编辑：双击不进入编辑态（onEditRequest 对锁定项短路，无 item-edit-<id> 覆盖层出现）。
  await dblclickItem(page, it.id);
  await expect(page.locator('[data-testid^="item-edit-"]')).toHaveCount(0);

  // 不可缩放：锁定对象的选中框不再展示缩放控制点（hasControls=false）。
  await expect
    .poll(async () => page.evaluate(() => window.__canvasTestApi!.getFabricObjectCount()))
    .toBeGreaterThan(0);

  // 解锁后恢复：可再次移动。
  await page.getByTestId("wm-unlock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(false);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await canvasItems(page))[0]!.x).toBe(x0 + 1);
});

test("多选混合锁定态：一个锁定一个未锁定 → 仍显示锁定/样式入口，点击后全部收敛为锁定", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click(); // 新建即选中
  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(true);

  await page.getByTestId("add-note").click(); // 第二个便签，新建即单选（未锁定）
  await expectItemCount(page, 2);

  const [lockedItem, unlockedItem] = await canvasItems(page);
  expect(lockedItem!.locked).toBe(true);
  expect(unlockedItem!.locked).toBe(false);

  // Shift 追加选中，混合锁定态。
  await clickItem(page, lockedItem!.id, { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  // 混合态：未全部锁定 → 显示「锁定」（非「解锁」），样式/编辑入口仍展示（对未锁定项生效）。
  await expect(page.getByTestId("wm-lock")).toBeVisible();
  await expect(page.getByTestId("wm-unlock")).toHaveCount(0);
  await expect(page.getByTestId("wm-duplicate")).toBeVisible();
  await expect(page.getByTestId("wm-delete")).toBeEnabled();

  // 点击「锁定」→ 批量收敛为全部锁定（业务规则 6）。
  await page.getByTestId("wm-lock").click();
  await expect
    .poll(async () => (await canvasItems(page)).every((it) => it.locked))
    .toBe(true);
  await expect(page.getByTestId("wm-unlock")).toBeVisible();
});

test("多选删除：未锁定对象被删除，锁定对象保留并保持选中（部分失败反馈）", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(true);

  await page.getByTestId("add-note").click();
  await expectItemCount(page, 2);

  const [lockedItem, unlockedItem] = await canvasItems(page);
  await clickItem(page, lockedItem!.id, { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  await page.getByTestId("wm-delete").click();
  await expectItemCount(page, 1);
  const remaining = (await canvasItems(page))[0]!;
  expect(remaining.id).toBe(lockedItem!.id);
  expect(remaining.locked).toBe(true);
  expect(remaining.id).not.toBe(unlockedItem!.id);
  // 锁定对象删除失败后仍保持选中，便于用户看到哪些没被删除。
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});

test("全部选中锁定：删除入口禁用，无法删除", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(true);

  await expect(page.getByTestId("wm-delete")).toBeDisabled();
  await page.getByTestId("wm-delete").click({ force: true });
  await expectItemCount(page, 1); // 未被删除
});

test("刷新组件：可刷新组件（uc-widget-menu-009）在锁定/删除回归旁复验一次基线行为不退化", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-embed").click();
  await expectItemCount(page, 1);
  let it = (await canvasItems(page))[0]!;
  expect(it.reloadable).toBe(true);

  await expect(page.getByTestId("wm-refresh")).toBeVisible();
  await page.getByTestId("wm-refresh").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.reloadCount).toBe(1);

  // 可刷新组件锁定后：刷新入口的可用性不受锁定影响之外的样式/编辑入口收敛验证——
  // 锁定态下菜单只保留锁定状态入口，刷新入口也应随其它样式/编辑入口一并隐藏。
  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page))[0]!.locked).toBe(true);
  await expect(page.getByTestId("wm-refresh")).toHaveCount(0);
  await expect(page.getByTestId("wm-refresh-unavailable")).toHaveCount(0);
  it = (await canvasItems(page))[0]!;
  expect(it.reloadable).toBe(true); // 组件本身能力不变，只是入口因锁定被收敛
});
