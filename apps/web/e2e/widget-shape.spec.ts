import { test, expect } from "@playwright/test";
import { canvasItems, clickItem, dblclickItem, expectItemCount, itemScreenRect } from "./helpers/canvas";

// p6:F15：形状组件（uc-widgets-004）
// - 创建：Board Menu「形状」入口（board-tool-shape）直接用上次选择的类型创建；旁边的
//   下拉箭头（board-tool-shape-menu）展开形状类型面板（board-shape-<type>），可切换类型
//   并立即创建（主流程 1-4：展示当前确认的 6 种类型——圆形/三角形/菱形/圆角矩形/矩形/
//   六边形，选择后设为当前工具并沿用到下次）。
// - 已有形状类型切换：Widget Menu 的 wm-shape-type 入口（业务规则 6：未展示该入口时不能
//   直接切换，本 spec 只覆盖入口存在时的切换）。
// - 形状本身仍以 type:"rect" 落库（服务端原生放行），具体类型经 color 的 "|shape=xxx"
//   哨兵表达（不新增持久化列，沿用 F12/F19/F20/F21 建立的编码约定）。
// - 文本、外观（填充/边框/透明度/文字色）、移动/缩放持久化均复用既有通用机制
//   （F07 拖拽缩放、F19 样式面板、F20 patch 落库），本 spec 验证这些机制对形状同样生效。

const uniq = () => `wshp_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "H", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Shapes" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("形状入口默认创建矩形，出现在画布并自动选中；服务端以原生 rect 落库", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");

  const it = (await canvasItems(page))[0]!;
  expect(it.kind).toBe("shape");
  expect(it.shapeType).toBe("rect");

  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].type)
    .toBe("rect");
});

test("形状类型下拉展示 UC 确认的 6 种类型，选择后创建对应类型并记住为下次默认", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("board-tool-shape-menu").click();
  await expect(page.getByTestId("board-shape-panel")).toBeVisible();
  for (const t of ["rect", "rounded", "circle", "triangle", "diamond", "hexagon"]) {
    await expect(page.getByTestId(`board-shape-${t}`)).toBeVisible();
  }

  await page.getByTestId("board-shape-circle").click();
  await expectItemCount(page, 1);
  let it = (await canvasItems(page))[0]!;
  expect(it.shapeType).toBe("circle");
  expect(it.kind).toBe("shape");

  // 持久化：color 落库带 "|shape=circle" 段。
  await expect
    .poll(async () => {
      const board = new URL(page.url()).pathname.split("/").pop();
      const body = await (await page.request.get(`/api/boards/${board}/items`)).json();
      return body.items[0].color as string;
    })
    .toContain("shape=circle");

  // 再次点击「形状」入口（不打开下拉）沿用上次选择的类型（主流程 4）。
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 2);
  const items = await canvasItems(page);
  const second = items.find((i) => i.id !== it.id)!;
  expect(second.shapeType).toBe("circle");
});

test("形状内输入文本：文字随形状展示，刷新后仍在", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  const it = (await canvasItems(page))[0]!;

  await dblclickItem(page, it.id);
  const editor = page.getByTestId(`item-edit-${it.id}`);
  await expect(editor).toBeVisible();
  await editor.fill("目标");
  await editor.blur();

  await expect.poll(async () => (await canvasItems(page))[0]!.text).toBe("目标");
  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].text)
    .toBe("目标");

  await page.reload();
  await expectItemCount(page, 1);
  expect((await canvasItems(page))[0]!.text).toBe("目标");
});

test("外观：边框/线宽/透明度/填充色对形状同样生效并持久化", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);

  await expect(page.getByTestId("wm-border")).toBeVisible();
  await expect(page.getByTestId("wm-border-width")).toBeVisible();
  await expect(page.getByTestId("wm-opacity")).toBeVisible();
  await expect(page.getByTestId("wm-textcolor")).toBeVisible();

  await page.getByTestId("wm-border").selectOption("blue");
  await page.getByTestId("wm-border-width").selectOption("4");
  await page.getByTestId("wm-opacity").selectOption("50");

  await expect.poll(async () => (await canvasItems(page))[0]!.border).toBe("blue");
  await expect.poll(async () => (await canvasItems(page))[0]!.borderWidth).toBe(4);
  await expect.poll(async () => (await canvasItems(page))[0]!.opacity).toBe(50);

  const color = () =>
    page.request.get(`/api/boards/${board.id}/items`).then((r) => r.json()).then((j) => j.items[0].color as string);
  await expect.poll(color).toContain("border=blue");
  await expect.poll(color).toContain("borderw=4");
  await expect.poll(color).toContain("opacity=50");

  await page.reload();
  await expectItemCount(page, 1);
  const it = (await canvasItems(page))[0]!;
  expect(it.border).toBe("blue");
  expect(it.borderWidth).toBe(4);
  expect(it.opacity).toBe(50);
});

test("已有形状可通过 Widget Menu 的形状类型入口切换类型，非形状对象不展示该入口", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("wm-shape-type")).toBeVisible();

  await page.getByTestId("wm-shape-type").selectOption("diamond");
  await expect.poll(async () => (await canvasItems(page))[0]!.shapeType).toBe("diamond");

  // 便签不是形状，不展示形状类型切换入口（业务规则 6）。
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 2);
  await expect(page.getByTestId("wm-shape-type")).toHaveCount(0);
});

test("移动/缩放：拖拽形状本体移动位置并持久化；缩放角点改变尺寸", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  let it = (await canvasItems(page))[0]!;
  const { x: x0, y: y0, w: w0, h: h0 } = it;

  // 移动：拖拽形状本体。
  let rect = await itemScreenRect(page, it.id);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await canvasItems(page))[0]!.x).not.toBe(x0);
  it = (await canvasItems(page))[0]!;
  expect(it.x).toBeGreaterThan(x0);
  expect(it.y).toBeGreaterThan(y0);

  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].x)
    .toBe(it.x);

  // 缩放：拖拽右下角控制点。
  rect = await itemScreenRect(page, it.id);
  const br = { x: rect.x + rect.width, y: rect.y + rect.height };
  await page.mouse.move(br.x, br.y);
  await page.mouse.down();
  await page.mouse.move(br.x + 50, br.y + 30, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await canvasItems(page))[0]!.w).toBeGreaterThan(w0);
  it = (await canvasItems(page))[0]!;
  expect(it.h).toBeGreaterThan(h0);

  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].w)
    .toBe(it.w);

  // 刷新后位置/尺寸仍在。
  await page.reload();
  await expectItemCount(page, 1);
  const after = (await canvasItems(page))[0]!;
  expect(after.x).toBe(it.x);
  expect(after.w).toBe(it.w);
});

test("层级：新建形状默认置顶，z-order 机制无需额外适配", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 2);
  const items = await canvasItems(page);
  const shape = items.find((i) => i.kind === "shape")!;
  const note = items.find((i) => i.kind === "note")!;
  expect(shape.z).toBeGreaterThan(note.z);

  // 置底后 z 反转（复用既有 Context Menu 的 z-order 调整，uc-context-menu-003，非形状专属）。
  await clickItem(page, shape.id, { button: "right" });
  await page.getByTestId("ctx-send-back").click();
  await expect
    .poll(async () => (await canvasItems(page)).find((i) => i.id === shape.id)!.z)
    .toBeLessThan((await canvasItems(page)).find((i) => i.id === note.id)!.z);
});
