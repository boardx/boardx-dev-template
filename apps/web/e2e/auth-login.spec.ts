import { test, expect } from "@playwright/test";

const uniq = () => `log_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerApi(request: import("@playwright/test").APIRequestContext, email: string) {
  await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
}

test("正确凭据登录成功", async ({ page, request }) => {
  const email = uniq();
  await registerApi(request, email);
  // 新 context 登录（清掉注册自动登录的 cookie）
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("current-user")).toContainText(email);
});

test("错误密码报「邮箱或密码无效」", async ({ page, request }) => {
  const email = uniq();
  await registerApi(request, email);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("wrong-pass");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("err-form")).toContainText("邮箱或密码无效");
});

test("登出后回到访客态", async ({ page, request }) => {
  const email = uniq();
  await registerApi(request, email);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("current-user")).toBeVisible();
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("guest")).toBeVisible();
});
