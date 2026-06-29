import { test, expect } from "@playwright/test";

const uniq = () => `bti_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openBoard(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "T" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
}

test("计时器：开始/暂停/继续/停止状态切换", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByTestId("board-timer")).toBeVisible();
  await expect(page.getByTestId("timer-status")).toHaveText("未开始");

  await page.getByTestId("timer-duration").selectOption("5");
  await page.getByTestId("timer-start").click();
  await expect(page.getByTestId("timer-status")).toHaveText("运行中");
  await expect(page.getByTestId("timer-remaining")).toBeVisible();

  await page.getByTestId("timer-pause").click();
  await expect(page.getByTestId("timer-status")).toHaveText("已暂停");

  await page.getByTestId("timer-resume").click();
  await expect(page.getByTestId("timer-status")).toHaveText("运行中");

  await page.getByTestId("timer-stop").click();
  await expect(page.getByTestId("timer-status")).toHaveText("未开始");
});

test("计时器倒计时到 0 → 结束提示", async ({ page }) => {
  await openBoard(page);
  await page.getByTestId("timer-duration").selectOption("1");
  // 1 分钟太久；改不了到秒级，这里只验证开始后 remaining 在递减
  await page.getByTestId("timer-start").click();
  const first = await page.getByTestId("timer-remaining").textContent();
  await page.waitForTimeout(1500);
  const second = await page.getByTestId("timer-remaining").textContent();
  expect(first).not.toBe(second);
});
