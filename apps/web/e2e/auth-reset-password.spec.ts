import { test, expect } from "@playwright/test";

const uniq = () => `rst_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("忘记密码→邮件令牌→重置→新密码登录", async ({ page, request }) => {
  const email = uniq();
  await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });

  // 发起忘记密码（响应不含令牌）
  const forgot = await request.post("/api/auth/forgot-password", { data: { email } });
  const forgotBody = await forgot.json();
  expect(forgotBody.token).toBeUndefined();
  expect(forgotBody.resetUrl).toBeUndefined();

  // dev 端点取令牌（模拟用户从邮箱拿到链接）
  const tokRes = await request.get(`/api/dev/reset-token?email=${encodeURIComponent(email)}`);
  const { token } = await tokRes.json();
  expect(token).toBeTruthy();

  // 打开重置页设新密码
  await page.goto(`/reset-password?token=${token}`);
  await page.getByTestId("next").fill("resetpass789");
  await page.getByTestId("confirm").fill("resetpass789");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("done")).toBeVisible();

  // 新密码登录成功
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("resetpass789");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("current-user")).toContainText(email);
});

test("已用令牌不可重复使用", async ({ request }) => {
  const email = uniq();
  await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  await request.post("/api/auth/forgot-password", { data: { email } });
  const { token } = await (await request.get(`/api/dev/reset-token?email=${encodeURIComponent(email)}`)).json();

  const first = await request.post("/api/auth/reset-password", { data: { token, next: "resetpass789" } });
  expect(first.ok()).toBeTruthy();
  const second = await request.post("/api/auth/reset-password", { data: { token, next: "another123" } });
  expect(second.status()).toBe(400);
});
