import { test, expect } from "@playwright/test";

// uc-share-001-view-shared-chat: 通过分享链接只读查看 AVA/chat 会话。
// 无需登录；有效 id 渲染只读消息且无输入框；未知 id 显示失效提示。

test("有效分享链接（未登录）显示只读消息，无输入框/发送", async ({ page }) => {
  // 不做任何登录步骤，直接访问公开分享页
  await page.goto("/share/demo");

  // 标题与消息列表可见
  await expect(page.getByTestId("share-title")).toBeVisible();
  const list = page.getByTestId("message-list");
  await expect(list).toBeVisible();
  await expect(list).toContainText("Q3 发布");

  // 用户消息与 AI 回复都渲染
  await expect(page.getByTestId("message-m1")).toHaveAttribute("data-role", "user");
  await expect(page.getByTestId("message-m2")).toHaveAttribute("data-role", "assistant");

  // 只读提示存在
  await expect(page.getByTestId("readonly-banner")).toContainText("Read only");

  // 无 composer / 输入框 / 发送按钮（只读）
  await expect(page.locator("textarea")).toHaveCount(0);
  await expect(page.locator('input[type="text"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /send|发送/i })).toHaveCount(0);
});

test("未知分享链接显示无法访问 / 链接失效提示", async ({ page }) => {
  await page.goto("/share/unknown");

  await expect(page.getByTestId("notfound")).toBeVisible();
  await expect(page.getByTestId("notfound")).toContainText("无法访问");

  // 既不渲染消息列表也无输入框
  await expect(page.getByTestId("message-list")).toHaveCount(0);
  await expect(page.locator("textarea")).toHaveCount(0);
});

test("空会话显示 No messages 提示", async ({ page }) => {
  await page.goto("/share/empty");

  await expect(page.getByTestId("share-title")).toBeVisible();
  await expect(page.getByTestId("empty")).toContainText("No messages");
  await expect(page.getByTestId("readonly-banner")).toBeVisible();
});
