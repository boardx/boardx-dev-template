import { test, expect } from "@playwright/test";

const uniq = () => `hob_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("新用户看到 Onboarding 引导，可关闭并重新打开", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/home");

  // 无 Agent 的新用户看到引导 + 入口
  await expect(page.getByTestId("onboarding")).toBeVisible();
  await expect(page.getByTestId("onboarding-store")).toBeVisible();
  await expect(page.getByTestId("onboarding-create")).toBeVisible();

  // 关闭后隐藏，出现重开入口
  await page.getByTestId("onboarding-dismiss").click();
  await expect(page.getByTestId("onboarding")).toBeHidden();
  await expect(page.getByTestId("onboarding-reopen")).toBeVisible();

  // 重新打开
  await page.getByTestId("onboarding-reopen").click();
  await expect(page.getByTestId("onboarding")).toBeVisible();
});

test("关闭引导后刷新仍保持关闭（localStorage 持久）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/home");
  await page.getByTestId("onboarding-dismiss").click();
  await page.reload();
  await expect(page.getByTestId("onboarding")).toBeHidden();
  await expect(page.getByTestId("onboarding-reopen")).toBeVisible();
});
