import { test, expect } from "@playwright/test";
import { clickItem, itemScreenRect, waitForCanvasReady, waitForItem } from "./helpers/canvas";

// issue #470：Widget Menu 从固定在画布中上的 dock 式布局，改为跟随选区的浮动 context
// toolbar（board-canvas.tsx 的 wmPos + useLayoutEffect）。覆盖验收清单的三个场景：
// 单选/多选/边缘（视口顶部会被 Header 遮住时翻转到下方）。

const uniq = () => `wmpos_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json())
    .board;
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  return board;
}

async function createNote(page: import("@playwright/test").Page, boardId: number | string, x: number, y: number) {
  const res = await page.request.post(`/api/boards/${boardId}/items`, {
    data: { type: "note", x, y, w: 180, h: 120, text: "n" },
  });
  return (await res.json()).item.id as string;
}

test("单选：工具条出现在对象正上方；取消选中消失", async ({ page }) => {
  const board = await openOwnBoard(page);
  const id = await createNote(page, board.id, 400, 300);
  await page.reload();
  await waitForCanvasReady(page);
  await waitForItem(page, id);

  await expect(page.getByTestId("widget-menu")).toBeHidden();
  await clickItem(page, id);

  const wm = page.getByTestId("widget-menu");
  await expect(wm).toBeVisible();
  const wmBox = (await wm.boundingBox())!;
  const itemRect = await itemScreenRect(page, id);

  // 工具条在对象上方（底边在对象顶边之上）。水平方向不用"居中距离"断言——单选一个便签就能
  // 展开色板/字重/字体/字号/斜体/对齐/边框/透明度/文字色等一长串控件，工具条经常宽到接近
  // 整个视口，为了不越界会被夹在窗口边缘（这是 issue #470 明确要的"水平夹在窗口内不溢出"
  // 行为，不是 bug），此时几何居中点必然偏离对象中心。改断言"水平范围与对象重叠或紧邻"，
  // 这才是"贴着选中对象"的真实验收意图。
  expect(wmBox.y + wmBox.height).toBeLessThanOrEqual(itemRect.y);
  const overlapsOrAdjacent =
    wmBox.x <= itemRect.x + itemRect.width + 20 && wmBox.x + wmBox.width >= itemRect.x - 20;
  expect(overlapsOrAdjacent).toBe(true);

  await page.keyboard.press("Escape");
  await expect(wm).toBeHidden();
});

test("多选：工具条锚定在选区并集包围盒上方，含批量操作入口", async ({ page }) => {
  const board = await openOwnBoard(page);
  const id1 = await createNote(page, board.id, 200, 200);
  const id2 = await createNote(page, board.id, 700, 500); // 远离第一个，避免包围盒重叠误判
  await page.reload();
  await waitForCanvasReady(page);
  await waitForItem(page, id1);
  await waitForItem(page, id2);

  await clickItem(page, id1);
  await clickItem(page, id2, { shift: true });

  const wm = page.getByTestId("widget-menu");
  await expect(wm).toBeVisible();
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");
  // p6:F21 批量操作已合并进同一浮动工具条（issue #470 业务规则 4），不另起炉灶。
  await expect(page.getByTestId("wm-align-objects-left")).toBeVisible();
  await expect(page.getByTestId("wm-group")).toBeVisible();

  const wmBox = (await wm.boundingBox())!;
  const r1 = await itemScreenRect(page, id1);
  const r2 = await itemScreenRect(page, id2);
  const bboxTop = Math.min(r1.y, r2.y);
  const bboxLeft = Math.min(r1.x, r2.x);
  const bboxRight = Math.max(r1.x + r1.width, r2.x + r2.width);

  // 工具条在并集包围盒上方；水平方向同单选场景理由，用重叠/紧邻代替居中距离断言。
  expect(wmBox.y + wmBox.height).toBeLessThanOrEqual(bboxTop + 1);
  const overlapsOrAdjacent = wmBox.x <= bboxRight + 20 && wmBox.x + wmBox.width >= bboxLeft - 20;
  expect(overlapsOrAdjacent).toBe(true);
});

test("边缘：对象贴视口顶部时工具条翻转到对象下方，不盖住 Header，也不压住下方紧邻的堆叠对象", async ({
  page,
}) => {
  const board = await openOwnBoard(page);
  // 场景坐标 y 很小 + 默认 100% 缩放、无 pan 偏移时，其屏幕位置会紧贴画布容器顶部
  // （容器顶部又紧贴 Header 下沿），足以触发"上方放不下"分支。
  const id = await createNote(page, board.id, 400, 10);
  // 紧邻放一个"下面堆叠的对象"——间距对齐 addNote 等新建函数当前的默认纵向堆叠间距
  // （issue #470 修复的一部分：从 130 加到 250，见 board-canvas.tsx addNote 等函数注释；
  // 130 的旧间距对 36~114px 高的浮动工具条来说太窄，翻转到下方必然压住下一个堆叠对象，
  // 真实回归见 canvas-select「点选/Shift多选」等曾经的失败）。这里断言的是"翻转到下方 +
  // 足够的默认间距"两者搭配之后，下方对象不会被工具条压住。
  const below = await createNote(page, board.id, 400, 260);
  await page.reload();
  await waitForCanvasReady(page);
  await waitForItem(page, id);
  await waitForItem(page, below);

  await clickItem(page, id);
  const wm = page.getByTestId("widget-menu");
  await expect(wm).toBeVisible();

  const wmBox = (await wm.boundingBox())!;
  const itemRect = await itemScreenRect(page, id);
  const belowRect = await itemScreenRect(page, below);
  const header = page.getByTestId("board-header");
  const headerBox = (await header.boundingBox())!;

  // 翻转到对象下方：工具条顶边在对象底边之下。
  expect(wmBox.y).toBeGreaterThanOrEqual(itemRect.y + itemRect.height - 1);
  // 不与 Header 重叠。
  expect(wmBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  // 不下探压住紧邻堆叠的下一个对象——工具条底边在它顶边之上。
  expect(wmBox.y + wmBox.height).toBeLessThanOrEqual(belowRect.y);

  // 下面那个对象仍可正常 shift+click 追加选中（工具条没有拦住它）。
  await clickItem(page, below, { shift: true });
  await expect(page.getByTestId("selection-count")).toHaveText("已选 2");
});
