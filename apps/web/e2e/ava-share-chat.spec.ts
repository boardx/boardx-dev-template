import { test, expect } from "@playwright/test";

const uniq = () => `ava_share_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(request: import("@playwright/test").APIRequestContext) {
  await request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "S", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("聊天头部分享：生成/复用/复制链接，公开只读页可访问，关闭后原链接 403", async ({
  page,
  context,
  playwright,
  baseURL,
}) => {
  await register(page.request);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto("/ava");
  await page.getByTestId("composer").fill("帮我总结公开分享能力");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("ava-share").click();
  await expect(page.getByTestId("share-panel")).toBeVisible();
  await page.getByTestId("share-copy").click();
  await expect(page.getByTestId("share-copy-status")).toContainText("已复制");

  const shareUrl = await page.getByTestId("share-link").inputValue();
  expect(shareUrl).toContain("/chatShare/");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shareUrl);

  await page.getByTestId("share-copy").click();
  await expect(page.getByTestId("share-link")).toHaveValue(shareUrl);

  const url = new URL(shareUrl);
  const anon = await playwright.request.newContext({ baseURL });
  const anonRes = await anon.get(`${url.pathname}${url.search}`);
  expect(anonRes.status()).toBe(200);
  await anon.dispose();

  await page.goto(shareUrl);
  await expect(page.getByTestId("share-title")).toBeVisible();
  await expect(page.getByTestId("shared-message-list")).toContainText("帮我总结公开分享能力");
  await expect(page.getByTestId("readonly-banner")).toContainText("Read only");
  await expect(page.locator("textarea")).toHaveCount(0);
  await expect(page.getByTestId("send")).toHaveCount(0);

  await page.goto("/ava");
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await page.getByTestId("ava-share").click();
  await page.getByTestId("share-disable").click();
  await expect(page.getByTestId("share-copy-status")).toContainText("分享已关闭");

  const disabledRes = await page.request.get(`${url.pathname}${url.search}`);
  expect(disabledRes.status()).toBe(403);

  await context.clearCookies();
  await page.goto(shareUrl);
  await expect(page.getByTestId("share-unavailable")).toBeVisible();
});

test("非线程 owner 不能关闭他人的分享链接", async ({ playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await register(owner);
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;
  const shareRes = await owner.post(`/api/ava/threads/${thread.id}/share`);
  expect(shareRes.status()).toBe(201);

  const other = await playwright.request.newContext({ baseURL });
  await register(other);
  const closeRes = await other.delete(`/api/ava/threads/${thread.id}/share`);
  expect(closeRes.status()).toBe(404);

  const { share } = await shareRes.json();
  const publicRes = await other.get(`/api/chatShare/${thread.id}?shareToken=${share.share_token}`);
  expect(publicRes.status()).toBe(200);

  await owner.dispose();
  await other.dispose();
});
