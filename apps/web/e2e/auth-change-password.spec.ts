import { test, expect } from "@playwright/test";

const uniq = () => `chg_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("修改密码后旧会话失效、新密码可登录、旧密码失败", async ({ page, request }) => {
  const email = uniq();
  // 注册（自动登录，page.request 与 page 共享 cookie）
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });

  await page.goto("/account");
  await page.getByTestId("current").fill("secret123");
  await page.getByTestId("next").fill("newsecret456");
  await page.getByTestId("confirm").fill("newsecret456");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("done")).toBeVisible();

  // 旧会话已失效：主页应为访客态
  await page.goto("/");
  await expect(page.getByTestId("guest")).toBeVisible();

  // 旧密码登录失败
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("err-form")).toBeVisible();

  // 新密码登录成功
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("newsecret456");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("current-user")).toContainText(email);
});

test("旧密码错误时拒绝修改", async ({ page }) => {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/account");
  await page.getByTestId("current").fill("wrong-old");
  await page.getByTestId("next").fill("newsecret456");
  await page.getByTestId("confirm").fill("newsecret456");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("err-form")).toContainText("当前密码不正确");
});
