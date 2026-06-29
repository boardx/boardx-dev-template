import { test, expect } from "@playwright/test";

const uniq = () => `reg_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("注册成功后自动登录并进入首页", async ({ page }) => {
  const email = uniq();
  await page.goto("/register");
  await page.getByTestId("firstName").fill("Ada");
  await page.getByTestId("lastName").fill("Lovelace");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("agreeTerms").check();
  await page.getByTestId("submit").click();

  await expect(page.getByTestId("current-user")).toContainText(email);
});

test("未勾选条款/弱密码显示字段错误", async ({ page }) => {
  await page.goto("/register");
  await page.getByTestId("firstName").fill("A");
  await page.getByTestId("lastName").fill("B");
  await page.getByTestId("email").fill(uniq());
  await page.getByTestId("password").fill("123"); // <6
  await page.getByTestId("submit").click(); // 未勾选条款
  await expect(page.getByTestId("err-password")).toBeVisible();
  await expect(page.getByTestId("err-agreeTerms")).toBeVisible();
});

test("重复邮箱注册被拒", async ({ page, request }) => {
  const email = uniq();
  await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/register");
  await page.getByTestId("firstName").fill("A");
  await page.getByTestId("lastName").fill("B");
  await page.getByTestId("email").fill(email);
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("agreeTerms").check();
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("err-email")).toContainText("已注册");
});
