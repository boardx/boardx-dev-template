import { test, expect } from "@playwright/test";
import { expectItemCount, itemScreenRect } from "./helpers/canvas";

// p6:F13：拖拽坐标源由 item DOM boundingBox 迁为渲染层 getItemScreenRect（canvas 兼容锚点，
// 策略 2 / issue #269）；参考线（alignment-guide）仍是 DOM 覆盖层，断言不变。意图逐条保留。

// uc-canvas-007 使用对齐参考线：拖动组件靠近其它组件的边缘/中心线时显示对齐参考线并吸附；
// 未触发吸附时组件停在释放位置。后置条件：组件位置与用户释放位置或参考线吸附位置一致。

const uniq = () => `ag_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json())
    .board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

// 拖动 item：mousedown 在其中心，分步移动到目标屏幕坐标，mouseup 释放。
async function dragItemTo(page: any, itemBox: { x: number; y: number; width: number; height: number }, targetScreenX: number, targetScreenY: number) {
  const cx = itemBox.x + itemBox.width / 2;
  const cy = itemBox.y + itemBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(targetScreenX, targetScreenY, { steps: 8 });
}

test("拖动组件靠近另一组件边缘 → 出现对齐参考线并吸附对齐", async ({ page }) => {
  const board = await openOwnBoard(page);

  // 两个便签：note0 (40,40)，note1 (40,170)。二者默认左边缘同为 x=40。
  await page.getByTestId("add-note").click();
  await page.getByTestId("add-note").click();
  await expectItemCount(page, 2);

  const readItems = async () =>
    (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items as {
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }[];

  const list = await readItems();
  list.sort((a, b) => a.y - b.y);
  const note0 = list[0]!;
  const note1 = list[1]!;
  expect(note0.x).toBe(40);
  expect(note1.x).toBe(40);

  // 先把 note1 拖到明显未对齐处（画布 x=300），远离 note0 的任何对齐线。
  const box1 = await itemScreenRect(page, note1.id);
  // 画布屏幕原点：note1 屏幕左边缘 - note1.x。
  const surfaceOriginX = box1.x - note1.x;
  const surfaceOriginY = box1.y - note1.y;
  // 目标：note1 中心 = 画布(300 + w/2, 170 + h/2) → 屏幕坐标。
  await dragItemTo(
    page,
    box1,
    surfaceOriginX + 300 + note1.w / 2,
    surfaceOriginY + 170 + note1.h / 2,
  );
  await page.mouse.up();

  // 未对齐释放：位置停在释放处（约 x=300），且此刻无参考线。
  await expect(page.getByTestId("alignment-guide")).toHaveCount(0);
  await expect
    .poll(async () => (await readItems()).find((i) => i.id === note1.id)!.x)
    .toBeGreaterThan(250);

  // 现在把 note1 的左边缘拖回到接近 note0 左边缘（x=40）附近：中心画布 x ≈ 43。
  // 位置从渲染层读（拖后本地 x 已更新），等本地状态拿到落库后的新位置再继续。
  await expect
    .poll(async () => (await itemScreenRect(page, note1.id)).x - surfaceOriginX)
    .toBeGreaterThan(250);
  const box1b = await itemScreenRect(page, note1.id);
  const cx = box1b.x + box1b.width / 2;
  const cy = box1b.y + box1b.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // 目标 note1 左边缘 ≈ 43（距 note0 左边缘 40 仅 3px，在吸附阈值内）。
  await page.mouse.move(surfaceOriginX + 43 + box1b.width / 2, cy, { steps: 10 });

  // 拖动中：出现对齐参考线（竖直，沿 note0 的对齐线；两便签等宽故左/中/右三线可能同时命中）。
  const guide = page.getByTestId("alignment-guide");
  await expect(guide.first()).toBeVisible();
  await expect
    .poll(async () => page.locator('[data-testid="alignment-guide"][data-orientation="v"]').count())
    .toBeGreaterThanOrEqual(1);

  await page.mouse.up();

  // 释放后参考线隐藏，note1 吸附回 x=40（与 note0 左边缘对齐）。
  await expect(page.getByTestId("alignment-guide")).toHaveCount(0);
  await expect
    .poll(async () => (await readItems()).find((i) => i.id === note1.id)!.x)
    .toBe(40);
});
