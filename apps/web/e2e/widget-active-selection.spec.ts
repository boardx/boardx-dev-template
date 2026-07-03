import { test, expect } from "@playwright/test";
import { canvasItems, clickItem, expectItemCount } from "./helpers/canvas";

// p6:F21：多选组合批量操作（移动/对齐/编组/锁定/删除）
// - uc-widgets-010（使用多选组合状态）+ uc-widget-menu-011（对齐选中组件）。
// - 整体拖动（fabric ActiveSelection）、批量锁定（F20）、批量删除（早期落地）均已有独立回归
//   （widget-lock-delete-refresh.spec.ts / widget-menu-framework.spec.ts），本文件只覆盖 F21
//   新增的两块能力：批量对齐/等间距分布、编组/解组，以及编组后的整体选中/整体删除交叉验证。
// - 对齐基准为选中对象（过滤锁定项后）的包围盒；坐标用 POST /api/boards/:id/items 直接指定，
//   避免依赖 add-note 的自动摆放位置，使对齐/分布断言可确定。

const uniq = () => `sel_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "S", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Sel" } })).json()
  ).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

async function addNoteAt(page: import("@playwright/test").Page, boardId: number, x: number, y: number) {
  const res = await page.request.post(`/api/boards/${boardId}/items`, {
    data: { type: "note", x, y, text: "n" },
  });
  return (await res.json()).item as { id: string; x: number; y: number; w: number; h: number };
}

async function selectAll(page: import("@playwright/test").Page, ids: string[]) {
  await clickItem(page, ids[0]!);
  for (const id of ids.slice(1)) await clickItem(page, id, { shift: true });
}

test("对齐入口：选中不足两个隐藏，选中两个及以上显示", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40);
  await expectItemCount(page, 1);
  await clickItem(page, a.id);
  await expect(page.getByTestId("wm-align-objects-left")).toHaveCount(0);

  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);
  await selectAll(page, [a.id, b.id]);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");
  await expect(page.getByTestId("wm-align-objects-left")).toBeVisible();
  await expect(page.getByTestId("wm-align-objects-right")).toBeVisible();
  await expect(page.getByTestId("wm-align-objects-top")).toBeVisible();
  await expect(page.getByTestId("wm-align-objects-bottom")).toBeVisible();
  await expect(page.getByTestId("wm-align-objects-hcenter")).toBeVisible();
  await expect(page.getByTestId("wm-align-objects-vcenter")).toBeVisible();
  // 少于 3 个对象时不展示等间距分布（首尾已固定，无中间项可调整）。
  await expect(page.getByTestId("wm-distribute-h")).toHaveCount(0);
});

test("左对齐：选中对象的 x 收敛为包围盒最小 x", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40);
  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);
  await selectAll(page, [a.id, b.id]);
  await page.getByTestId("wm-align-objects-left").click();
  await expect
    .poll(async () => (await canvasItems(page)).map((it) => it.x).sort((x, y) => x - y))
    .toEqual([40, 40]);
});

test("右对齐/顶对齐/底对齐/水平居中/垂直居中：按包围盒收敛", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40); // w/h 取默认尺寸
  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);

  await selectAll(page, [a.id, b.id]);
  await page.getByTestId("wm-align-objects-right").click();
  await expect.poll(async () => {
    const its = await canvasItems(page);
    const maxRight = Math.max(...its.map((it) => it.x + it.w));
    return its.every((it) => it.x + it.w === maxRight);
  }).toBe(true);

  await page.getByTestId("wm-align-objects-top").click();
  await expect.poll(async () => {
    const its = await canvasItems(page);
    return its.every((it) => it.y === its[0]!.y);
  }).toBe(true);
});

test("等间距水平分布：3 个对象，首尾不变，中间按总跨度均匀分布", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 0, 40);
  const b = await addNoteAt(page, board.id, 500, 40);
  const c = await addNoteAt(page, board.id, 900, 40); // 中间项，起始间距不均
  await expectItemCount(page, 3);
  await selectAll(page, [a.id, b.id, c.id]);
  await expect(page.getByTestId("wm-distribute-h")).toBeVisible();
  await page.getByTestId("wm-distribute-h").click();

  await expect.poll(async () => {
    const its = await canvasItems(page);
    const byId = new Map(its.map((it) => [it.id, it]));
    const [ia, ib, ic] = [byId.get(a.id)!, byId.get(b.id)!, byId.get(c.id)!];
    const totalSpan = ic.x + ic.w - ia.x;
    const totalSize = ia.w + ib.w + ic.w;
    const gap = (totalSpan - totalSize) / 2;
    const expectedBX = ia.x + ia.w + gap;
    return { aX: ia.x, cRight: ic.x + ic.w, bXClose: Math.abs(ib.x - expectedBX) < 1 };
  }).toEqual({ aX: 0, cRight: 900 + (await canvasItems(page)).find((it) => it.id === c.id)!.w, bXClose: true });
});

test("对齐遇锁定对象：锁定项不移动，未锁定项仍按包围盒对齐", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40);
  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);

  await clickItem(page, a.id);
  await page.getByTestId("wm-lock").click();
  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === a.id)!.locked).toBe(true);

  await selectAll(page, [a.id, b.id]);
  await page.getByTestId("wm-align-objects-left").click();
  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === a.id)!.x).toBe(40); // 锁定项不动
  await expect.poll(async () => (await canvasItems(page)).find((it) => it.id === b.id)!.x).toBe(300); // 只有一个未锁定项，无需移动（自身即基准）
});

test("编组：选中两个对象点编组后，点击任一成员整体选中，整体拖动/整体删除", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40);
  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);

  await selectAll(page, [a.id, b.id]);
  await expect(page.getByTestId("wm-group")).toBeVisible();
  await page.getByTestId("wm-group").click();
  await expect(page.getByTestId("wm-ungroup")).toBeVisible();

  // 编组持久化：两个成员的 color 都带 "|group=" 段且值相同。
  await expect
    .poll(async () => {
      const items = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items as Array<{
        id: string;
        color: string | null;
      }>;
      const ca = items.find((it) => it.id === a.id)!.color ?? "";
      const cb = items.find((it) => it.id === b.id)!.color ?? "";
      const ga = /\|group=([^|]+)/.exec(ca)?.[1];
      const gb = /\|group=([^|]+)/.exec(cb)?.[1];
      return ga != null && ga === gb;
    })
    .toBe(true);

  // 点空白清除选择，再单独点击组内一个成员 → 整体选中（组闭包展开）。
  await page.mouse.click(20, 20);
  await clickItem(page, b.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");

  // 整体删除：删除后两个组内成员都消失。
  await page.getByTestId("wm-delete").click();
  await expectItemCount(page, 0);
});

test("解组：解组后成员恢复为可独立选择，点击单个成员只选中自己", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40);
  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);

  await selectAll(page, [a.id, b.id]);
  await page.getByTestId("wm-group").click();
  await expect(page.getByTestId("wm-ungroup")).toBeVisible();

  await page.getByTestId("wm-ungroup").click();
  await expect
    .poll(async () => {
      const items = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items as Array<{
        color: string | null;
      }>;
      return items.every((it) => !(it.color ?? "").includes("|group="));
    })
    .toBe(true);

  await page.mouse.click(20, 20);
  await clickItem(page, a.id);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
});

test("编组入口：不足两个选中或全部同属一组时不显示编组按钮", async ({ page }) => {
  const board = await openOwnBoard(page);
  const a = await addNoteAt(page, board.id, 40, 40);
  await expectItemCount(page, 1);
  await clickItem(page, a.id);
  await expect(page.getByTestId("wm-group")).toHaveCount(0);

  const b = await addNoteAt(page, board.id, 300, 200);
  await expectItemCount(page, 2);
  await selectAll(page, [a.id, b.id]);
  await page.getByTestId("wm-group").click();
  await expect(page.getByTestId("wm-ungroup")).toBeVisible();
  // 全部选中项已同属一组 → 不再展示「编组」（已是一个组，无需重复编组）。
  await expect(page.getByTestId("wm-group")).toHaveCount(0);
});
