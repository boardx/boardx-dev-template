import { test, expect } from "@playwright/test";
import { canvasItems, clickItem, expectItemCount } from "./helpers/canvas";

// p6:F19：组件样式调整 + 应用格式
// - uc-widget-menu-002（调整组件样式）：边框色/边框宽（含线宽语义）/透明度/文字色。样式编码在
//   item.color 的 "|k=v" 段（沿用 F12 建立的 withStyle/styleGet 约定：border/borderw/opacity/
//   textcolor），经渲染层解析后暴露在 window.__canvasTestApi.getItems()。多选批量与混合态复用
//   F12 已建立的模式（getXxx 取交集 first，不同值时 UI 显示「混合」）。
// - uc-widget-menu-010（应用格式）：单选一个文本/便签类对象后点击「应用格式」进入取样模式，
//   连续点击目标文本/便签即把源对象的可复用样式（背景/字重/字体/字号/对齐/斜体/边框/线宽/
//   透明度/文字色）整体复制过去；Esc/切工具退出取样模式。

const uniq = () => `wsty_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  // 新用户欢迎引导（board_welcome_dismissed）默认展示在画布左下区域，多便签纵向排列时会遮挡
  // 点击（真实回归，非本文件特有）；沿用 context-menu-003 等既有 spec 的做法提前关闭。
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "T", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Sty" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("Widget Menu 显示边框/线宽/透明度/文字色入口 + 应用格式入口", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("wm-border")).toBeVisible();
  await expect(page.getByTestId("wm-border-width")).toBeVisible();
  await expect(page.getByTestId("wm-opacity")).toBeVisible();
  await expect(page.getByTestId("wm-textcolor")).toBeVisible();
  await expect(page.getByTestId("wm-apply-format")).toBeVisible();
});

test("边框色/线宽/透明度/文字色：实时预览 + 持久化（刷新仍在）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 1);

  await page.getByTestId("wm-border").selectOption("blue");
  await page.getByTestId("wm-border-width").selectOption("4");
  await page.getByTestId("wm-opacity").selectOption("50");
  await page.getByTestId("wm-textcolor").selectOption("green");

  await expect.poll(async () => (await canvasItems(page))[0]!.border).toBe("blue");
  await expect.poll(async () => (await canvasItems(page))[0]!.borderWidth).toBe(4);
  await expect.poll(async () => (await canvasItems(page))[0]!.opacity).toBe(50);
  await expect.poll(async () => (await canvasItems(page))[0]!.textColor).toBe("green");

  const color = () =>
    page.request.get(`/api/boards/${board.id}/items`).then((r) => r.json()).then((j) => j.items[0].color as string);
  await expect.poll(color).toContain("border=blue");
  await expect.poll(color).toContain("borderw=4");
  await expect.poll(color).toContain("opacity=50");
  await expect.poll(color).toContain("textcolor=green");

  await page.reload();
  await expectItemCount(page, 1);
  const it = (await canvasItems(page))[0]!;
  expect(it.border).toBe("blue");
  expect(it.borderWidth).toBe(4);
  expect(it.opacity).toBe(50);
  expect(it.textColor).toBe("green");
});

test("默认值不写样式段（保持 color 干净，与 F12 约定一致）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-border").selectOption("blue");
  await page.getByTestId("wm-border").selectOption("none"); // 改回默认
  await expect.poll(async () => (await canvasItems(page))[0]!.border).toBe("none");
  const color = () =>
    page.request.get(`/api/boards/${board.id}/items`).then((r) => r.json()).then((j) => j.items[0].color as string);
  await expect.poll(color).not.toContain("border=");
});

test("多选混合态：两个便签边框不同 → wm-border 显示混合；统一设置后不再混合", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-border").selectOption("blue");
  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("add-note").click(); // 第二个便签，边框仍为默认 none
  await expectItemCount(page, 2);

  const ids = (await canvasItems(page)).map((it) => it.id);
  await clickItem(page, ids[0]!);
  await clickItem(page, ids[1]!, { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  const borderSelect = page.getByTestId("wm-border");
  await expect(borderSelect).toHaveValue("");

  await borderSelect.selectOption("red");
  await expect.poll(async () => (await canvasItems(page)).every((it) => it.border === "red")).toBe(true);
  await expect(borderSelect).toHaveValue("red");
});

test("应用格式：设置源便签样式 → 进入取样模式 → 点击目标便签 → 样式复制过去", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-color-blue").click();
  await page.getByTestId("wm-bold").click();
  await page.getByTestId("wm-border").selectOption("red");
  await page.getByTestId("wm-opacity").selectOption("75");

  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("add-note").click(); // 第二个便签（目标），样式仍为默认
  await expectItemCount(page, 2);

  const ids = (await canvasItems(page)).map((it) => it.id);
  const sourceId = ids[0]!;
  const targetId = ids[1]!;

  // 选中源，进入取样模式
  await clickItem(page, sourceId);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await page.getByTestId("wm-apply-format").click();
  await expect(page.getByTestId("format-paint-indicator")).toBeVisible();

  // 点击目标应用格式
  await clickItem(page, targetId);

  const target = () => canvasItems(page).then((items) => items.find((it) => it.id === targetId)!);
  await expect.poll(async () => (await target()).bold).toBe(true);
  await expect.poll(async () => (await target()).border).toBe("red");
  await expect.poll(async () => (await target()).opacity).toBe(75);

  const targetColor = await (
    await (await page.request.get(`/api/boards/${board.id}/items`)).json()
  ).items.find((it: { id: string }) => it.id === targetId).color as string;
  expect(targetColor).toContain("blue"); // 背景色也随格式一并复制
  expect(targetColor).toContain(":bold");
  expect(targetColor).toContain("border=red");
  expect(targetColor).toContain("opacity=75");

  // 源对象样式不受影响
  const source = () => canvasItems(page).then((items) => items.find((it) => it.id === sourceId)!);
  expect((await source()).border).toBe("red");
});

test("应用格式：连续应用到多个目标，直到 Esc 退出取样模式", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("wm-textcolor").selectOption("blue");
  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("add-note").click();
  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 3);

  // 默认 addNote 纵向堆叠（x=40 固定列），第三个便签的屏幕位置与左下角小地图
  // （data-testid="minimap-viewport"）重叠会截获点击；改为横向排布，避开固定 UI 浮层。
  const beforeIds = (await canvasItems(page)).map((it) => it.id);
  await Promise.all(
    beforeIds.map((id, i) =>
      page.request.patch(`/api/board-items/${id}`, { data: { x: 40 + i * 260, y: 40 } }),
    ),
  );
  await page.reload();
  await expectItemCount(page, 3);

  const ids = (await canvasItems(page)).map((it) => it.id);
  const [sourceId, targetA, targetB] = ids;

  await clickItem(page, sourceId!);
  await page.getByTestId("wm-apply-format").click();
  await clickItem(page, targetA!);
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === targetA)!.textColor)
    .toBe("blue");
  // 仍在取样模式（连续应用）
  await expect(page.getByTestId("format-paint-indicator")).toBeVisible();
  await clickItem(page, targetB!);
  await expect
    .poll(async () => (await canvasItems(page)).find((it) => it.id === targetB)!.textColor)
    .toBe("blue");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("format-paint-indicator")).toHaveCount(0);
});

test("应用格式：形状不作为来源，取样入口对形状隐藏", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expect(page.getByTestId("wm-apply-format")).toHaveCount(0);
});
