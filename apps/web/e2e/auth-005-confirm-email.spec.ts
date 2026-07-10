import { test, expect } from "@playwright/test";

const uniq = () => `confirm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndGetConfirmToken(request: import("@playwright/test").APIRequestContext) {
  const email = uniq();
  await request.post("/api/auth/register", {
    data: { firstName: "C", lastName: "User", email, password: "secret123", agreeTerms: true },
  });
  const tokenRes = await request.get(
    `/api/dev/reset-token?email=${encodeURIComponent(email)}&type=confirm_email`,
  );
  expect(tokenRes.ok()).toBeTruthy();
  const body = (await tokenRes.json()) as { token?: string | null };
  expect(body.token).toBeTruthy();
  return { email, token: body.token! };
}

test("有效令牌 → 确认成功，可去登录/工作区", async ({ page }) => {
  const { token } = await registerAndGetConfirmToken(page.request);
  await page.goto(`/confirm-email?token=${token}`);
  await expect(page.getByTestId("success")).toBeVisible();
  await expect(page.getByTestId("to-workspace")).toBeVisible();
  await expect(page.getByTestId("to-login")).toBeVisible();
});

test("无效/过期令牌 → 确认失败", async ({ page }) => {
  await page.goto("/confirm-email?token=bad-token");
  await expect(page.getByTestId("error")).toBeVisible();
  await expect(page.getByTestId("resend")).toBeVisible();
});

test("缺少令牌 → 确认失败", async ({ page }) => {
  await page.goto("/confirm-email");
  await expect(page.getByTestId("error")).toBeVisible();
});

test("API：confirm_email token 一次性可消费；unknown → 400", async ({ request }) => {
  const { token } = await registerAndGetConfirmToken(request);

  const good = await request.post("/api/auth/confirm-email", { data: { token } });
  expect(good.ok()).toBeTruthy();
  expect((await good.json()).ok).toBe(true);

  const reused = await request.post("/api/auth/confirm-email", { data: { token } });
  expect(reused.status()).toBe(400);

  const bad = await request.post("/api/auth/confirm-email", { data: { token: "nope" } });
  expect(bad.status()).toBe(400);
});
