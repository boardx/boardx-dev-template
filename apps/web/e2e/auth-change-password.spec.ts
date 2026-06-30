import { test, expect } from "@playwright/test";

const uniq = () => `chg_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("修改密码后旧会话失效、新密码可登录、旧密码失败", async ({ page, request }) => {
  const email = uniq();
  // 注册（自动登录，page.request 与 page 共享 cookie）
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });

  await page.goto("/account");
  await page.getByTestId("tab-security").click(); // 改密在 Security 分区
  await page.getByTestId("current").fill("secret123");
  await page.getByTestId("next").fill("newsecret456");
  await page.getByTestId("confirm").fill("newsecret456");

  // 显式等待改密接口返回，确保服务端已完成 deleteUserSessions + 清 cookie，
  // 再断言，避免把后续断言压在尚未结算的会话失效上。
  const [chgRes] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/change-password") && r.request().method() === "POST"
    ),
    page.getByTestId("submit-security").click(),
  ]);
  expect(chgRes.ok()).toBeTruthy();
  await expect(page.getByTestId("done")).toBeVisible();

  // 改密成功后 account 页会自动 router.push("/login")。先等这次自动跳转结算，
  // 否则它会与下面手动的 page.goto 竞争（"navigation interrupted"），这正是
  // 全量套件下偶发失败的根因。等到落在 /login 即代表跳转已完成、无悬挂导航。
  await page.waitForURL("**/login");

  // 旧会话已失效：主页应为访客态
  await page.goto("/");
  await expect(page.getByTestId("guest")).toBeVisible();

  // 旧密码登录失败
  await page.goto("/login");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("err-form")).toBeVisible();

  // 新密码登录成功：等导航到首页落定后再断言已登录态
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("newsecret456");
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    page.getByTestId("submit").click(),
  ]);
  await expect(page.getByTestId("current-user")).toContainText(email);
});

test("旧密码错误时拒绝修改", async ({ page }) => {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/account");
  await page.getByTestId("tab-security").click();
  await page.getByTestId("current").fill("wrong-old");
  await page.getByTestId("next").fill("newsecret456");
  await page.getByTestId("confirm").fill("newsecret456");
  await page.getByTestId("submit-security").click();
  await expect(page.getByTestId("err-sec")).toContainText("当前密码不正确");
});
