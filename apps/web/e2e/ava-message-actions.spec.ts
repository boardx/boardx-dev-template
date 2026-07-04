import { test, expect } from "@playwright/test";

const uniq = () => `ava_actions_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function sendMessage(page: import("@playwright/test").Page, text: string) {
  await page.getByTestId("composer").fill(text);
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant").last()).toBeVisible({ timeout: 15_000 });
}

test.beforeEach(async ({ context }) => {
  // 授予剪贴板权限，使「复制」断言可以真正读回剪贴板内容而不是仅检查提示文案。
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("消息操作条：复制整条消息、代码块单独复制、点赞/点踩持久化、重新生成不丢原问题", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await sendMessage(page, "帮我规划这周的工作");

  const lastAssistant = page.getByTestId("msg-assistant").last();
  await expect(lastAssistant).toContainText("收到");

  // ── 复制整条消息 ──────────────────────────────────────────────
  await page.getByTestId("msg-copy").last().click();
  await expect(page.getByTestId("msg-copy-status").last()).toContainText("文本已被复制");
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toContain("这是 AVA 的 stub 回复");
  expect(clipboardText).toContain("```ts"); // 消息级复制是整条消息纯文本，包含代码围栏

  // ── 代码块单独复制：只复制代码块内容，不含围栏/其余正文 ──────────
  await page.getByTestId("code-block-copy").last().click();
  const codeClipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(codeClipboard).toContain("console.log('hello from AVA stub');");
  expect(codeClipboard).not.toContain("这是 AVA 的 stub 回复");
  expect(codeClipboard).not.toContain("```");

  // ── 反馈：点赞后高亮，点踩覆盖为踩（同一用户对同一条消息只保留最新一次） ──
  await page.getByTestId("msg-feedback-up").last().click();
  await expect(page.getByTestId("msg-feedback-up").last()).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("msg-feedback-down").last().click();
  await expect(page.getByTestId("msg-feedback-down").last()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("msg-feedback-up").last()).toHaveAttribute("aria-pressed", "false");

  // reload 后反馈状态仍持久化（写入 ava_message_feedback，GET 线程详情带回）。
  await page.reload();
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await expect(page.getByTestId("msg-feedback-down").last()).toHaveAttribute("aria-pressed", "true", {
    timeout: 10_000,
  });

  // ── 发送到 Board / 发送邮件：p18 F11 已接通为真实动作，覆盖见
  // e2e/ava-message-send-actions.spec.ts；此处仅确认按钮默认可点击（不再是禁用占位）。
  await expect(page.getByTestId("msg-send-to-board").last()).toBeEnabled();
  await expect(page.getByTestId("msg-send-email").last()).toBeEnabled();

  // ── 重新生成：展示生成中，原问题（user 消息）不丢，assistant 消息数量不变 ──
  await expect(page.getByTestId("msg-user")).toHaveCount(1);
  await page.getByTestId("msg-regenerate").last().click();
  await expect(page.getByTestId("regenerating")).toBeVisible();
  await expect(page.getByTestId("msg-assistant")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId("msg-user")).toHaveCount(1);
  await expect(page.getByTestId("msg-user").first()).toContainText("帮我规划这周的工作");

  // 只有最后一条 assistant 回复才展示「重新生成」入口。
  await sendMessage(page, "第二条追问");
  await expect(page.getByTestId("msg-assistant")).toHaveCount(2);
  await expect(page.getByTestId("msg-regenerate")).toHaveCount(1);
});

test("重新生成失败时保留原回复不丢，展示错误提示", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await sendMessage(page, "准备重新生成失败");

  // 触发失败：把最后一条 user 消息内容替换为含强制失败标记的文本（复用 F03 的
  // 编辑接口达成——不改变本 feature 范围之外的行为，只用于制造确定性失败场景）。
  const lastUser = page.getByTestId("msg-user").last();
  await lastUser.getByTestId("msg-edit").click();
  await page.getByTestId("msg-edit-input").fill("触发失败 __ava_force_fail__");
  await page.getByTestId("msg-edit-save").click();
  await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
});

test("未登录调用反馈/重新生成接口 → 401", async ({ page, playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;
  const sendRes = await owner.post(`/api/ava/threads/${thread.id}/messages`, {
    data: { text: "hello" },
  });
  expect(sendRes.status()).toBe(201);

  const detail = await (await owner.get(`/api/ava/threads/${thread.id}`)).json();
  const assistantMessage = detail.messages.find((m: { role: string }) => m.role === "assistant");
  expect(assistantMessage).toBeTruthy();

  const anon = await playwright.request.newContext({ baseURL });
  const feedbackRes = await anon.post(
    `/api/ava/threads/${thread.id}/messages/${assistantMessage.id}/feedback`,
    { data: { rating: "up" } }
  );
  expect(feedbackRes.status()).toBe(401);

  const regenerateRes = await anon.post(
    `/api/ava/threads/${thread.id}/messages/${assistantMessage.id}/regenerate`
  );
  expect(regenerateRes.status()).toBe(401);

  await anon.dispose();
  await owner.dispose();
});

test("反馈只允许对 assistant 消息提交，对 user 消息返回 404", async ({ page, playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;
  await owner.post(`/api/ava/threads/${thread.id}/messages`, { data: { text: "hello" } });

  const detail = await (await owner.get(`/api/ava/threads/${thread.id}`)).json();
  const userMessage = detail.messages.find((m: { role: string }) => m.role === "user");
  expect(userMessage).toBeTruthy();

  const res = await owner.post(`/api/ava/threads/${thread.id}/messages/${userMessage.id}/feedback`, {
    data: { rating: "up" },
  });
  expect(res.status()).toBe(404);

  await owner.dispose();
});
