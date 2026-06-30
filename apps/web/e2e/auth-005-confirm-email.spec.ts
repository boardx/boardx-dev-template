import { test, expect } from "@playwright/test";

test("有效令牌 → 确认成功，可去登录/工作区", async ({ page }) => {
  await page.goto("/confirm-email?token=demo");
  await expect(page.getByTestId("success")).toBeVisible();
  await expect(page.getByTestId("to-workspace")).toBeVisible();
  await expect(page.getByTestId("to-login")).toBeVisible();
});

test("无效令牌 → 链接无效或已过期，可重新发送", async ({ page }) => {
  await page.goto("/confirm-email?token=bad");
  await expect(page.getByTestId("error")).toBeVisible();
  await expect(page.getByTestId("resend")).toBeVisible();
});

test("缺少令牌 → 确认失败", async ({ page }) => {
  await page.goto("/confirm-email");
  await expect(page.getByTestId("error")).toBeVisible();
});

test("API：known token demo → ok；unknown → 400", async ({ request }) => {
  const good = await request.post("/api/auth/confirm-email", { data: { token: "demo" } });
  expect(good.ok()).toBeTruthy();
  expect((await good.json()).ok).toBe(true);

  const bad = await request.post("/api/auth/confirm-email", { data: { token: "nope" } });
  expect(bad.status()).toBe(400);
});
