import { test, expect } from "@playwright/test";
import { canvasItems, clickCanvasBlank, clickItem, connectorEndpoints, expectItemCount, itemScreenRect } from "./helpers/canvas";

// p6:F16：连接线组件 + 连接线样式（uc-widgets-005 + uc-widget-menu-012）
// - 创建：Board Menu「连接线」入口（board-tool-connector）激活连接线创建模式，依次点击源组件、
//   目标组件建立连接（主流程 3 的等价简化实现——两次独立点击代替按住拖拽，取舍见 board-canvas.tsx
//   的 createConnector 注释：拖拽 + 实时预览线的单手势交互会连带影响 fabric 自身的点击命中判定，
//   两次点击更简单也更容易验证，完全避开那条路径）；点空白处则保留自由端点（备选流程 1）。
// - 持久化：连接线以 type:"note" 落库（服务端只放行 note/rect），color 头为 "connector"，
//   "|from=<id>"/"|to=<id>" 段记录绑定的源/目标组件 id（沿用 F12/F15/F19/F20/F21 建立的
//   "|k=v" 哨兵编码约定，不新增持久化列）。
// - 跟随移动：绑定组件的一端不落固定坐标，客户端按当前组件矩形动态重算最近边锚点
//   （resolveConnectorEndpoints），组件移动后连接线端点跟随，经 __canvasTestApi.getConnectorEndpoints
//   断言实际渲染的端点画布坐标发生了相应变化。
// - 样式：Widget Menu 复用 wm-border/wm-border-width 表达连接线颜色/线宽；新增
//   wm-connector-line（直线/曲线）与 wm-connector-arrow（无/尾部/两端箭头），仅在选中项全部为
//   连接线时展示（业务规则 1/4：菜单入口按类型区分，且只暴露已确认的颜色/线宽/直线曲线/箭头）。

const uniq = () => `wconn_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "C", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Conn" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

// 两个形状放在明显分开的位置（横向排布，避开左下角小地图/欢迎引导等固定 UI 浮层，
// 与既有 widget-style.spec.ts 的排布注释一致）。
async function makeTwoShapes(page: import("@playwright/test").Page, boardId: string) {
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 2);
  const ids = (await canvasItems(page)).map((it) => it.id);
  await Promise.all(
    ids.map((id, i) => page.request.patch(`/api/board-items/${id}`, { data: { x: 60 + i * 320, y: 60 } })),
  );
  await page.reload();
  await expectItemCount(page, 2);
  const items = await canvasItems(page);
  return { boardId, a: items[0]!, b: items[1]! };
}

// 依次点击源组件、目标组件建连（两次独立点击，见上方文件头注释的交互取舍）。
async function pickConnector(
  page: import("@playwright/test").Page,
  fromId: string,
  toId: string,
) {
  await page.getByTestId("board-tool-connector").click();
  const fromRect = await itemScreenRect(page, fromId);
  await page.mouse.click(fromRect.x + fromRect.width / 2, fromRect.y + fromRect.height / 2);
  const toRect = await itemScreenRect(page, toId);
  await page.mouse.click(toRect.x + toRect.width / 2, toRect.y + toRect.height / 2);
  // 建连是异步落库（POST + PATCH）后才 setActiveTool("select")，等工具真正切回，
  // 避免后续对连接线的 clickItem 被仍处于 connectorPickMode 的画布误判为又一次连接线拾取点击。
  await expect(page.getByTestId("board-tool-connector")).toHaveAttribute("aria-pressed", "false");
}

test("连接线工具：从源组件拖拽到目标组件建立连接，落库为 note + connector 哨兵 + from/to 段", async ({ page }) => {
  const board = await openOwnBoard(page);
  const { a, b } = await makeTwoShapes(page, board.id);

  await pickConnector(page, a.id, b.id);
  await expectItemCount(page, 3);

  const items = await canvasItems(page);
  const conn = items.find((it) => it.kind === "connector")!;
  expect(conn).toBeTruthy();
  expect(conn.color).toContain("connector");
  expect(conn.color).toContain(`from=${a.id}`);
  expect(conn.color).toContain(`to=${b.id}`);

  // 服务端持久化：type 仍为 note（服务端只放行 note/rect），color 携带完整哨兵。
  await expect
    .poll(async () => {
      const body = await (await page.request.get(`/api/boards/${board.id}/items`)).json();
      return body.items.find((it: { id: string }) => it.id === conn.id).type as string;
    })
    .toBe("note");
  const persistedColor = await (
    await (await page.request.get(`/api/boards/${board.id}/items`)).json()
  ).items.find((it: { id: string }) => it.id === conn.id).color as string;
  expect(persistedColor).toContain(`from=${a.id}`);
  expect(persistedColor).toContain(`to=${b.id}`);

  // 建连后自动选中该连接线并回到选择工具（一次性创建节奏，同 addShape 之外的其它创建工具）。
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("board-tool-connector")).not.toHaveAttribute("aria-pressed", "true");
});

test("点到空白处：保留自由端点连接线（备选流程 1）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  const shape = (await canvasItems(page))[0]!;
  await page.request.patch(`/api/board-items/${shape.id}`, { data: { x: 60, y: 60 } });
  await page.reload();
  await expectItemCount(page, 1);

  await page.getByTestId("board-tool-connector").click();
  const rect = await itemScreenRect(page, shape.id);
  await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
  // 第二次点击画布空白处（避开小地图/其它固定 UI 浮层）。
  const viewport = await page.getByTestId("canvas-viewport").boundingBox();
  await page.mouse.click(viewport!.x + viewport!.width - 60, viewport!.y + 40);

  await expectItemCount(page, 2);
  const conn = (await canvasItems(page)).find((it) => it.kind === "connector")!;
  expect(conn.color).toContain(`from=${shape.id}`);
  expect(conn.color).not.toContain("to=");

  const persistedColor = await (
    await (await page.request.get(`/api/boards/${board.id}/items`)).json()
  ).items.find((it: { id: string }) => it.id === conn.id).color as string;
  expect(persistedColor).toContain("tx=");
  expect(persistedColor).toContain("ty=");
});

test("跟随移动：拖动源组件后，连接线端点随之重算（不再是原来的画布坐标）", async ({ page }) => {
  const board = await openOwnBoard(page);
  const { a, b } = await makeTwoShapes(page, board.id);
  await pickConnector(page, a.id, b.id);
  await expectItemCount(page, 3);
  const conn = (await canvasItems(page)).find((it) => it.kind === "connector")!;

  const before = await connectorEndpoints(page, conn.id);
  expect(before).not.toBeNull();

  // 拖动源组件 a 到新位置。
  await page.getByTestId("board-tool-select").click();
  const rectA = await itemScreenRect(page, a.id);
  const cx = rectA.x + rectA.width / 2;
  const cy = rectA.y + rectA.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy + 140, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === a.id)!.y).not.toBe(a.y);

  const after = await connectorEndpoints(page, conn.id);
  expect(after).not.toBeNull();
  expect(after!.from).not.toEqual(before!.from);
});

test("Widget Menu：选中连接线展示颜色/线宽/直线曲线/端点箭头入口，非连接线不展示专属入口", async ({ page }) => {
  const board = await openOwnBoard(page);
  const { a, b } = await makeTwoShapes(page, board.id);
  await pickConnector(page, a.id, b.id);
  await expectItemCount(page, 3);
  const conn = (await canvasItems(page)).find((it) => it.kind === "connector")!;

  await clickItem(page, conn.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("wm-border")).toBeVisible();
  await expect(page.getByTestId("wm-border-width")).toBeVisible();
  await expect(page.getByTestId("wm-connector-line")).toBeVisible();
  await expect(page.getByTestId("wm-connector-arrow")).toBeVisible();
  // 连接线无文字/透明度语义，不展示这些入口（业务规则 4）。
  await expect(page.getByTestId("wm-opacity")).toHaveCount(0);
  await expect(page.getByTestId("wm-textcolor")).toHaveCount(0);
  await expect(page.getByTestId("wm-bold")).toHaveCount(0);

  // 形状选中时不展示连接线专属入口。
  await clickItem(page, a.id);
  await expect(page.getByTestId("wm-connector-line")).toHaveCount(0);
  await expect(page.getByTestId("wm-connector-arrow")).toHaveCount(0);

  void board;
});

test("样式：颜色/线宽/线型/箭头即时更新并持久化（刷新仍在）", async ({ page }) => {
  const board = await openOwnBoard(page);
  const { a, b } = await makeTwoShapes(page, board.id);
  await pickConnector(page, a.id, b.id);
  await expectItemCount(page, 3);
  const conn = (await canvasItems(page)).find((it) => it.kind === "connector")!;
  await clickItem(page, conn.id);

  await page.getByTestId("wm-border").selectOption("blue");
  await page.getByTestId("wm-border-width").selectOption("4");
  await page.getByTestId("wm-connector-line").selectOption("curve");
  await page.getByTestId("wm-connector-arrow").selectOption("both");

  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === conn.id)!.border).toBe("blue");
  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === conn.id)!.borderWidth).toBe(4);

  const color = () =>
    page.request.get(`/api/boards/${board.id}/items`).then((r) => r.json()).then(
      (j) => j.items.find((it: { id: string }) => it.id === conn.id).color as string,
    );
  await expect.poll(color).toContain("border=blue");
  await expect.poll(color).toContain("borderw=4");
  await expect.poll(color).toContain("linetype=curve");
  await expect.poll(color).toContain("arrow=both");

  await page.reload();
  await expectItemCount(page, 3);
  const after = (await canvasItems(page)).find((it) => it.id === conn.id)!;
  expect(after.border).toBe("blue");
  expect(after.borderWidth).toBe(4);
});

test("锁定连接线：拖端点/改样式/删除均不可用，仅保留解锁入口", async ({ page }) => {
  const board = await openOwnBoard(page);
  const { a, b } = await makeTwoShapes(page, board.id);
  await pickConnector(page, a.id, b.id);
  await expectItemCount(page, 3);
  const conn = (await canvasItems(page)).find((it) => it.kind === "connector")!;
  await clickItem(page, conn.id);
  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === conn.id)!.locked).toBe(true);

  await clickCanvasBlank(page);
  await clickItem(page, conn.id);
  await expect(page.getByTestId("wm-unlock")).toBeVisible();
  await expect(page.getByTestId("wm-connector-line")).toHaveCount(0);
  await expect(page.getByTestId("wm-border")).toHaveCount(0);
  await expect(page.getByTestId("wm-delete")).toBeVisible(); // 删除按钮仍渲染（disabled 由 allSelectedLocked 控制）

  void board;
});
