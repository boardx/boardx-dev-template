import { test, expect } from "@playwright/test";

const uniq = () => `ava_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("登录用户：空态建议 → 发送 → user+assistant 气泡 → reload 后线程仍在", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  // 空态：建议动作可见
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("suggestion").first()).toBeVisible();

  // 发送一条消息
  await page.getByTestId("composer").fill("帮我规划这周的工作");
  await page.getByTestId("send").click();

  // user 气泡 + assistant（stub）回复都出现
  await expect(page.getByTestId("msg-user")).toContainText("帮我规划这周的工作");
  await expect(page.getByTestId("msg-assistant")).toContainText("占位回复");

  // 线程出现在左栏列表
  await expect(page.getByTestId("thread-list")).toBeVisible();

  // reload：线程持久化（内存，per-user），点开后历史消息可再次加载
  await page.reload();
  await expect(page.getByTestId("thread-list")).toBeVisible();
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await expect(page.getByTestId("msg-user")).toContainText("帮我规划这周的工作");
  await expect(page.getByTestId("msg-assistant")).toContainText("占位回复");
});

test("未登录访问 /ava：跳转 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/ava");
  await expect(page).toHaveURL(/\/login/);
});

test("空消息被 API 拒绝（保留输入，不创建线程）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/ava", { data: { text: "   " } });
  expect(res.status()).toBe(400);
});
