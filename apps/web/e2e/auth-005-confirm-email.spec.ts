import { test, expect } from "@playwright/test";

const uniq = () => `cfm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndGetConfirmToken(
  request: import("@playwright/test").APIRequestContext,
  email: string
): Promise<string> {
  await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  const res = await request.get(`/api/dev/confirm-token?email=${encodeURIComponent(email)}`);
  const { token } = await res.json();
  return token;
}

test("有效令牌 → 确认成功，可去登录/工作区", async ({ page, request }) => {
  const email = uniq();
  const token = await registerAndGetConfirmToken(request, email);
  expect(token).toBeTruthy();

  await page.goto(`/confirm-email?token=${token}`);
  await expect(page.getByTestId("success")).toBeVisible();
  await expect(page.getByTestId("to-workspace")).toBeVisible();
  await expect(page.getByTestId("to-login")).toBeVisible();
});

test("无效令牌 → 链接无效或已过期，可重新发送", async ({ page }) => {
  await page.goto("/confirm-email?token=bad-unknown-token");
  await expect(page.getByTestId("error")).toBeVisible();
  await expect(page.getByTestId("resend")).toBeVisible();
});

test("缺少令牌 → 确认失败", async ({ page }) => {
  await page.goto("/confirm-email");
  await expect(page.getByTestId("error")).toBeVisible();
});

test("已用令牌不可重复使用", async ({ request }) => {
  const email = uniq();
  const token = await registerAndGetConfirmToken(request, email);

  const first = await request.post("/api/auth/confirm-email", { data: { token } });
  expect(first.ok()).toBeTruthy();
  expect((await first.json()).ok).toBe(true);

  const second = await request.post("/api/auth/confirm-email", { data: { token } });
  expect(second.status()).toBe(400);
});

test("API：真实生成的 token → ok；未知 token → 400", async ({ request }) => {
  const email = uniq();
  const token = await registerAndGetConfirmToken(request, email);

  const good = await request.post("/api/auth/confirm-email", { data: { token } });
  expect(good.ok()).toBeTruthy();
  expect((await good.json()).ok).toBe(true);

  const bad = await request.post("/api/auth/confirm-email", { data: { token: "nope-unknown" } });
  expect(bad.status()).toBe(400);
});
