import { test, expect, type Page } from "@playwright/test";
import { expectItemCount, itemScreenRect } from "./helpers/canvas";

// p6:F07 拖动时的对齐参考线（uc-canvas-007 增强）：
// 1. 中心线对齐：不同宽度组件中心接近 → 竖直参考线 + 吸附，释放后消失、位置落库。
// 2. 等间距：拖动第三个组件到与既有间距相等处 → 间距提示（spacing-hint）+ 吸附，释放后消失。
// 3. 缩放吸附：拖单选组件的角点缩放控制点，移动边接近邻居边缘 → 参考线 + 吸附，w/h 落库。
// 基础边缘吸附由 canvas-007-use-alignment-guidelines.spec.ts 覆盖（F06 基线，保持绿）。

const uniq = () => `gl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

interface ApiItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// 新板的欢迎引导卡（welcome-guide，bottom-left）会遮住低处 item 的指针操作，先关掉。
async function dismissGuide(page: Page) {
  const btn = page.getByTestId("welcome-dismiss");
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

async function openOwnBoard(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "G" } })).json())
    .board;
  await page.goto(`/boards/${board.id}`);
  return board as { id: string };
}

async function readItems(page: Page, boardId: string): Promise<ApiItem[]> {
  return ((await (await page.request.get(`/api/boards/${boardId}/items`)).json()).items ?? []) as ApiItem[];
}

// 创建 n 个便签并把它们 PATCH 到指定矩形（w/h 走 F07 新增的尺寸落库），随后刷新页面同步本地状态。
async function setupItems(
  page: Page,
  boardId: string,
  rects: Array<{ x: number; y: number; w?: number; h?: number }>,
): Promise<ApiItem[]> {
  for (let i = 0; i < rects.length; i++) await page.getByTestId("add-note").click();
  await expectItemCount(page, rects.length);
  const list = await readItems(page, boardId);
  list.sort((a, b) => a.y - b.y);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    const res = await page.request.patch(`/api/board-items/${list[i]!.id}`, {
      data: { x: r.x, y: r.y, w: r.w ?? 160, h: r.h ?? 100 },
    });
    expect(res.ok()).toBe(true);
  }
  await page.reload();
  await expectItemCount(page, rects.length);
  await dismissGuide(page);
  const fresh = await readItems(page, boardId);
  return list.map((it) => fresh.find((f) => f.id === it.id)!);
}

// 画布坐标 → 屏幕坐标的原点（视口默认 scale=1）。
async function surfaceOrigin(page: Page, item: ApiItem) {
  const box = await itemScreenRect(page, item.id);
  return { ox: box.x - item.x, oy: box.y - item.y };
}

test("不同宽度组件中心接近 → 中心参考线 + 吸附，释放后参考线消失且位置落库", async ({ page }) => {
  const board = await openOwnBoard(page);
  // note0: (40,40,200x100)，中心 x=140；note1: (400,300,80x100) 拖动目标。
  const [note0, note1] = await setupItems(page, board.id, [
    { x: 40, y: 40, w: 200 },
    { x: 400, y: 300, w: 80 },
  ]);

  const { ox, oy } = await surfaceOrigin(page, note1!);
  const box = await itemScreenRect(page, note1!.id);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 目标 x=98 → note1 中心 138，与 note0 中心 140 差 2（阈值内）；
  // note1 边缘 98/178 与 note0 锚点 {40,140,240} 均差 > 6 → 纯中心对齐。
  await page.mouse.move(ox + 98 + 40, oy + 300 + 50, { steps: 10 });

  const vGuides = page.locator('[data-testid="alignment-guide"][data-orientation="v"]');
  await expect(vGuides.first()).toBeVisible();

  await page.mouse.up();
  await expect(page.getByTestId("alignment-guide")).toHaveCount(0);
  // 吸附后 note1 中心 = 140 → x = 100。
  await expect
    .poll(async () => (await readItems(page, board.id)).find((i) => i.id === note1!.id)!.x)
    .toBe(100);
});

test("拖动第三个组件形成等间距 → 间距提示出现并吸附，释放后提示消失", async ({ page }) => {
  const board = await openOwnBoard(page);
  // A[40..200] gap100 B[300..460]，C 从远处拖到 B 右侧 gap≈105 处 → 吸附到 560（gap=100）。
  const [, , C] = await setupItems(page, board.id, [
    { x: 40, y: 40 },
    { x: 300, y: 40 },
    { x: 900, y: 40 },
  ]);

  const { ox, oy } = await surfaceOrigin(page, C!);
  const box = await itemScreenRect(page, C!.id);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 目标 x=565（与 B 间隙 105，在阈值内）→ 等间距吸附到 560。
  await page.mouse.move(ox + 565 + 80, oy + 40 + 50, { steps: 12 });

  const hints = page.locator('[data-testid="spacing-hint"][data-orientation="h"]');
  await expect(hints.first()).toBeVisible();
  // 两段等间隙提示，间距值 = 100。
  await expect(hints).toHaveCount(2);
  await expect(hints.first()).toHaveAttribute("data-gap", "100");
  await expect(hints.first()).toHaveText("100");

  await page.mouse.up();
  await expect(page.getByTestId("spacing-hint")).toHaveCount(0);
  await expect(page.getByTestId("alignment-guide")).toHaveCount(0);
  await expect
    .poll(async () => (await readItems(page, board.id)).find((i) => i.id === C!.id)!.x)
    .toBe(560);
});

test("角点缩放：移动边接近邻居右边缘 → 参考线 + 吸附，释放后 w/h 落库", async ({ page }) => {
  const board = await openOwnBoard(page);
  // 布局避开左下角的 minimap 与 welcome-guide：放在 x=600。
  // note0 右边缘 800；note1 初始 w=160（右边缘 760），拖 br 角到右边缘 ≈803 → 吸附 800。
  const [, note1] = await setupItems(page, board.id, [
    { x: 600, y: 40, w: 200 },
    { x: 600, y: 200 },
  ]);

  // 先选中（角点控制点仅在选中框上出现）。
  const box = await itemScreenRect(page, note1!.id);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect
    .poll(async () => page.evaluate(() => window.__canvasTestApi!.getSelectedIds()))
    .toEqual([note1!.id]);

  const { ox } = await surfaceOrigin(page, note1!);
  // br 控制点位于选中框右下角（padding 2）。
  const cornerX = box.x + box.width + 2;
  const cornerY = box.y + box.height + 2;
  await page.mouse.move(cornerX, cornerY);
  await page.mouse.down();
  // 右边缘拖到画布 x≈803（距 note0 右边缘 800 差 3）；y 不动保持高度不变。
  await page.mouse.move(ox + 803, cornerY, { steps: 8 });

  const vGuides = page.locator('[data-testid="alignment-guide"][data-orientation="v"]');
  await expect(vGuides.first()).toBeVisible();

  await page.mouse.up();
  await expect(page.getByTestId("alignment-guide")).toHaveCount(0);
  // 吸附后右边缘 = 800 → w = 200；高度与原点不变。
  await expect
    .poll(async () => {
      const it = (await readItems(page, board.id)).find((i) => i.id === note1!.id)!;
      return { w: it.w, h: it.h, x: it.x };
    })
    .toEqual({ w: 200, h: 100, x: 600 });
});
