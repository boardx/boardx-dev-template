import { test, expect } from "@playwright/test";

const uniq = () => `slides_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// uc-board-header-005-manage-slides：
// header 幻灯片入口 → 侧栏创建 → 排序 → 展示 → 导出，状态与操作一致。
test("幻灯片管理：创建 → 排序 → 展示 → 导出", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "L", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Slides" } })).json()
  ).board;

  await page.goto(`/boards/${board.id}`);
  await expect(page.getByTestId("board-header")).toBeVisible();

  // 打开侧栏，空状态引导。
  await page.getByTestId("slides-open").click();
  await expect(page.getByTestId("slides-panel")).toBeVisible();
  await expect(page.getByTestId("slides-empty")).toBeVisible();
  await expect(page.getByTestId("slides-count")).toHaveText("0");

  // 创建两张幻灯片。
  await page.getByTestId("slides-add").click();
  await page.getByTestId("slides-add").click();
  await expect(page.getByTestId("slides-count")).toHaveText("2");
  const items = page.getByTestId("slide-item");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0).getByTestId("slide-title")).toHaveText("幻灯片 1");
  await expect(items.nth(1).getByTestId("slide-title")).toHaveText("幻灯片 2");

  // 排序：把第二张上移到开头，顺序应翻转。
  await items.nth(1).getByTestId("slide-move-up").click();
  await expect(page.getByTestId("slide-item").nth(0).getByTestId("slide-title")).toHaveText("幻灯片 2");
  await expect(page.getByTestId("slide-item").nth(1).getByTestId("slide-title")).toHaveText("幻灯片 1");

  // 展示：进入演示视图，显示当前（第一张）幻灯片。
  await page.getByTestId("slides-present").click();
  await expect(page.getByTestId("slides-present-view")).toBeVisible();
  await expect(page.getByTestId("slides-present-title")).toHaveText("幻灯片 2");
  // 翻到下一张。
  await page.getByTestId("slides-present-next").click();
  await expect(page.getByTestId("slides-present-title")).toHaveText("幻灯片 1");
  await page.getByTestId("slides-present-exit").click();
  await expect(page.getByTestId("slides-present-view")).toHaveCount(0);

  // 导出：产出可断言的序列化产物。
  await page.getByTestId("slides-export").click();
  const result = page.getByTestId("slides-export-result");
  await expect(result).toBeVisible();
  const text = await result.textContent();
  expect(text).toContain("\"count\": 2");
  expect(text).toContain("幻灯片 2");
  expect(text).toContain("幻灯片 1");
});
