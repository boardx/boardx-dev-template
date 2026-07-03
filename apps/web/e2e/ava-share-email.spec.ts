import { test, expect } from "@playwright/test";

// p18 F08：分享聊天「发送到我的邮箱」。
// 邮件断言口径与 auth 一致（dev transport：落库 sink + dev-only 端点），
// 经 /api/dev/outbox 断言真实发信动作发生且内容含分享链接。

const uniq = () => `ava_mail_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(request: import("@playwright/test").APIRequestContext, email: string) {
  const res = await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "M", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function startChat(page: import("@playwright/test").Page) {
  await page.goto("/ava");
  await page.getByTestId("composer").fill("帮我总结邮件分享能力");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });
}

test("未开启分享时点击发送邮件：自动生成链接并真实发出含分享链接的邮件", async ({ page }) => {
  const email = uniq();
  await register(page.request, email);
  await startChat(page);

  await page.getByTestId("ava-share").click();
  await expect(page.getByTestId("share-panel")).toBeVisible();
  // 前置：分享尚未开启，链接输入框为空。
  await expect(page.getByTestId("share-link")).toHaveValue("");

  await page.getByTestId("share-email").click();

  // 独立成功提示（不与「复制链接」的 share-copy-status 共用元素），且写明收件邮箱。
  await expect(page.getByTestId("share-email-status")).toContainText(email);
  await expect(page.getByTestId("share-copy-status")).toHaveCount(0);
  await expect(page.getByTestId("err-share-email")).toHaveCount(0);

  // 自动生成了分享链接（面板同步展示）。
  const shareUrl = await page.getByTestId("share-link").inputValue();
  expect(shareUrl).toContain("/chatShare/");
  expect(shareUrl).toContain("shareToken=");

  // 邮件断言：dev outbox 里存在发给当前用户的邮件，正文包含该分享链接。
  const outRes = await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`);
  expect(outRes.ok()).toBeTruthy();
  const { mail } = (await outRes.json()) as {
    mail: { to_email: string; kind: string; body: string };
  };
  expect(mail.to_email).toBe(email);
  expect(mail.kind).toBe("ava_share_link");
  expect(mail.body).toContain(shareUrl);

  // 分享链接真实可用：匿名可访问公开 API。
  const url = new URL(shareUrl);
  const anonRes = await page.request.get(`/api${url.pathname}${url.search}`);
  expect(anonRes.status()).toBe(200);
});

test("已开启分享时点击发送邮件：复用现有链接发送", async ({ page, context }) => {
  const email = uniq();
  await register(page.request, email);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startChat(page);

  await page.getByTestId("ava-share").click();
  await page.getByTestId("share-copy").click();
  await expect(page.getByTestId("share-copy-status")).toContainText("已复制");
  const existingUrl = await page.getByTestId("share-link").inputValue();
  expect(existingUrl).toContain("shareToken=");

  await page.getByTestId("share-email").click();
  await expect(page.getByTestId("share-email-status")).toContainText(email);
  // 链接未变（复用而不是重新生成）。
  await expect(page.getByTestId("share-link")).toHaveValue(existingUrl);

  const { mail } = (await (
    await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`)
  ).json()) as { mail: { body: string } };
  expect(mail.body).toContain(existingUrl);
});

test("邮件服务不可用时展示独立错误提示，不污染复制链接提示", async ({ page }) => {
  const email = uniq();
  await register(page.request, email);
  await startChat(page);

  // 注入失败：拦截邮件端点返回 500（模拟邮件服务不可用）。
  await page.route("**/api/ava/threads/*/share/email", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "mail down" }) })
  );

  await page.getByTestId("ava-share").click();
  await page.getByTestId("share-email").click();

  await expect(page.getByTestId("err-share-email")).toContainText("发送邮件失败");
  // 独立性：不出现邮件成功提示，也不污染「复制链接」的提示/错误元素。
  await expect(page.getByTestId("share-email-status")).toHaveCount(0);
  await expect(page.getByTestId("share-copy-status")).toHaveCount(0);
  await expect(page.getByTestId("err-share")).toHaveCount(0);

  // 失败后未真实发信：outbox 无该用户邮件。
  const outRes = await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`);
  expect(outRes.status()).toBe(404);
});

test("未登录调用发送邮件端点返回 401；非属主返回 404", async ({ playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await register(owner, uniq());
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;

  const anon = await playwright.request.newContext({ baseURL });
  expect((await anon.post(`/api/ava/threads/${thread.id}/share/email`)).status()).toBe(401);

  const other = await playwright.request.newContext({ baseURL });
  await register(other, uniq());
  expect((await other.post(`/api/ava/threads/${thread.id}/share/email`)).status()).toBe(404);

  await owner.dispose();
  await anon.dispose();
  await other.dispose();
});
