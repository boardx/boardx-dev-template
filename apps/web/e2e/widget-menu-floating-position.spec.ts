import { test, expect } from "@playwright/test";
import {
  canvasItems,
  clickItem,
  expectItemCount,
  itemScreenRect,
  waitForCanvasReady,
  waitForItem,
} from "./helpers/canvas";

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

// PR #525 review 修复（coord-main CHANGES）：selectionBBox 曾经对 connector 直接用落库的
// x/y/w/h（创建时刻的初始包围盒），但 connector 绑定端点后，端点由 resolveConnectorEndpoints
// 按"当前"源/目标组件矩形动态重算最近锚点——组件一移动，落库 bbox 就和真实端点脱节。
// 这里复现真实场景：建两个组件、拉一条绑定连接线、移动源组件、再选中连接线，断言工具条
// 锚定在移动后的真实端点附近，而不是移动前的旧位置。
test("connector：绑定端点跟随组件移动后，工具条锚定在真实端点而非落库的陈旧包围盒", async ({ page }) => {
  const board = await openOwnBoard(page);

  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 1);
  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("board-tool-shape").click();
  await expectItemCount(page, 2);
  const shapeIds = (await canvasItems(page)).map((it) => it.id);
  await Promise.all(
    shapeIds.map((id, i) =>
      page.request.patch(`/api/board-items/${id}`, { data: { x: 60 + i * 320, y: 400 } }),
    ),
  );
  await page.reload();
  await waitForCanvasReady(page);
  await expectItemCount(page, 2);
  const [a, b] = await canvasItems(page);

  // 建一条从 a 到 b 的绑定连接线（两次点击建连，与 widget-connector.spec.ts 同一套交互）。
  await page.getByTestId("board-tool-connector").click();
  const aRectBefore = await itemScreenRect(page, a!.id);
  await page.mouse.click(aRectBefore.x + aRectBefore.width / 2, aRectBefore.y + aRectBefore.height / 2);
  const bRect = await itemScreenRect(page, b!.id);
  await page.mouse.click(bRect.x + bRect.width / 2, bRect.y + bRect.height / 2);
  await expect(page.getByTestId("board-tool-connector")).toHaveAttribute("aria-pressed", "false");
  await expectItemCount(page, 3);
  const connectorId = (await canvasItems(page)).find((it) => it.kind === "connector")!.id;

  // 把源组件 a 挪到画布顶部（贴视口顶部，与"边缘"场景同理会让 connector 从上方翻转到下方），
  // 落库的 connector x/y/w/h（若被误用）仍停留在 a 的旧位置（y=400 附近），真实断言必须
  // 观察到工具条跟着 a 的新位置走，而不是旧位置。
  await page.request.patch(`/api/board-items/${a!.id}`, { data: { x: 60, y: 20 } });
  await page.reload();
  await waitForCanvasReady(page);
  await waitForItem(page, connectorId);

  await clickItem(page, connectorId);
  const wm = page.getByTestId("widget-menu");
  await expect(wm).toBeVisible();
  await expect(page.getByTestId("wm-connector-line")).toBeVisible(); // 确认真选中的是连接线本身

  const endpoints = await page.evaluate(
    (id) => window.__canvasTestApi!.getConnectorEndpoints(id),
    connectorId,
  );
  expect(endpoints).not.toBeNull();
  const connectorRaw = (await canvasItems(page)).find((it) => it.id === connectorId)!;
  const containerRect = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="canvas-viewport"]');
    const r = el!.getBoundingClientRect();
    return { left: r.left, top: r.top };
  });
  // 端点画布坐标 → 屏幕坐标（100% 缩放、无 pan 时 vp.tx/ty 均为 0，与 board-canvas.tsx
  // selectionBBox 用的换算公式一致）。
  const endpointScreenYs = [endpoints!.from.y + containerRect.top, endpoints!.to.y + containerRect.top];
  // 陈旧包围盒的屏幕坐标——connector 自己落库的 x/y/w/h，创建那一刻的初始位置，a 挪走后
  // 从未更新过。y=400（场景坐标）离视口顶部/Header 很远，不会触发翻转，所以 bug 版逻辑会把
  // 工具条摆在这个陈旧 bbox 正上方（GAP=10）——推算出 bug 版本"应该"落在哪个 y，再和真实
  // 渲染结果比距离，比直接拿 staleBboxScreenTop 本身比更精确（两个真实端点一个贴顶一个没动，
  // staleBboxScreenTop 恰好离修复后的正确位置也不算远，直接比容易误判）。
  const staleBboxScreenTop = connectorRaw.y + containerRect.top;
  const wmBox = (await wm.boundingBox())!;
  const buggyPredictedTop = staleBboxScreenTop - 10 - wmBox.height;

  // 正向断言：工具条贴着真实端点（其中一端因 a 被挪到顶部而大幅上移）——顶边或底边
  // 与某个真实端点的距离要足够近，不能只是笼统"差不多"。
  const nearAnEndpoint = endpointScreenYs.some(
    (y) => Math.abs(wmBox.y - y) < 60 || Math.abs(wmBox.y + wmBox.height - y) < 60,
  );
  expect(nearAnEndpoint).toBe(true);
  // 反向断言（真正抓回归的那一条）：工具条不能落在"如果用陈旧 bbox 计算，应该会摆到哪"的
  // 预测位置附近——这条断言在改这条修复之前会失败（本地验证过：临时改回旧逻辑后，
  // wmBox.y 与这个预测值几乎重合，断言会红；改回真实端点口径后两者相差 100+px，稳定绿）。
  expect(Math.abs(wmBox.y - buggyPredictedTop)).toBeGreaterThan(60);
});
