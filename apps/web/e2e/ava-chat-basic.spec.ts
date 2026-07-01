import { test, expect } from "@playwright/test";

const uniq = () => `ava_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("登录用户：空态建议 → 发送 → user+assistant(Markdown/代码块) 气泡 → 线程入列表 → reload 后可继续追问", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  // 空态：建议动作可见
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("suggestion").first()).toBeVisible();

  // 发送第一条消息（隐式创建线程：POST /api/ava/threads 后 POST .../messages）
  await page.getByTestId("composer").fill("帮我规划这周的工作");
  await page.getByTestId("send").click();

  // user 气泡立即出现
  await expect(page.getByTestId("msg-user")).toContainText("帮我规划这周的工作");

  // assistant 回复以流式出现，最终完整内容可见；渲染为 Markdown（标题）+ 代码块
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });
  const assistantMsg = page.getByTestId("msg-assistant");
  await expect(assistantMsg).toContainText("收到", { timeout: 15_000 });
  await expect(assistantMsg.locator("pre code")).toBeVisible();

  // 线程出现在左栏列表，可继续追问
  await expect(page.getByTestId("thread-list")).toBeVisible();

  await page.getByTestId("composer").fill("再来一条追问");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-user")).toHaveCount(2);
  await expect(page.getByTestId("msg-assistant")).toHaveCount(2, { timeout: 15_000 });

  // 持久化：reload 后线程仍在，点开后历史消息可再次加载
  await page.reload();
  await expect(page.getByTestId("thread-list")).toBeVisible();
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await expect(page.getByTestId("msg-user").first()).toContainText("帮我规划这周的工作");
  await expect(page.getByTestId("msg-assistant").first()).toBeVisible();
});

test("未登录访问 /ava：跳转 /login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/ava");
  await expect(page).toHaveURL(/\/login/);
});

test("空消息被 API 拒绝（400，不创建线程）", async ({ page }) => {
  await register(page);
  const createRes = await page.request.post("/api/ava/threads");
  expect(createRes.status()).toBe(201);
  const { thread } = await createRes.json();

  const res = await page.request.post(`/api/ava/threads/${thread.id}/messages`, {
    data: { text: "   " },
  });
  expect(res.status()).toBe(400);
});

test("生成失败：展示失败态，用户输入已持久化不丢失", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  // 特殊触发词让 stub provider 主动抛错（sanctioned test hook，见 packages/ai FORCE_FAIL_MARKER）
  await page.getByTestId("composer").fill("触发失败 __ava_force_fail__");
  await page.getByTestId("send").click();

  // 用户消息仍然可见（未丢失）
  await expect(page.getByTestId("msg-user")).toContainText("触发失败");
  // 失败态展示，且给出可见的错误提示
  await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("send-error")).toBeVisible();

  // reload 后失败态消息仍持久化（未丢用户输入历史）
  await page.reload();
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await expect(page.getByTestId("msg-user").first()).toContainText("触发失败");
  await expect(page.getByTestId("msg-failed")).toBeVisible();
});

test("未登录调用发消息接口 → 401", async ({ page, playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;

  const anon = await playwright.request.newContext({ baseURL });
  const res = await anon.post(`/api/ava/threads/${thread.id}/messages`, { data: { text: "x" } });
  expect(res.status()).toBe(401);
  await anon.dispose();
  await owner.dispose();
});
