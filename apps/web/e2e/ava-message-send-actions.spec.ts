import { test, expect } from "@playwright/test";

// p18 F11：消息「发送到 Board」「发送邮件」接通。
// 覆盖：发送到 Board 成功路径 + 无编辑权限 Board、发送邮件成功 + 频控命中（第二次点击被拦截）。

const uniq = () => `ava_send_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page, email: string) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "S", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function startChat(page: import("@playwright/test").Page) {
  await page.goto("/ava");
  await page.getByTestId("composer").fill("帮我总结发送到 Board 的能力");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });
}

test("发送到 Board：选择有编辑权限的白板后写入便利贴并展示成功提示", async ({ page }) => {
  const email = uniq();
  await register(page, email);

  // 准备一个自己拥有编辑权限的白板（房间属主 = board owner）。
  const room = (await (await page.request.post("/api/rooms", { data: { name: "SendBoardRoom" } })).json())
    .room;
  const board = (
    await (
      await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Target Board" } })
    ).json()
  ).board;

  await startChat(page);

  await page.getByTestId("msg-send-to-board").last().click();
  await expect(page.getByTestId("board-picker")).toBeVisible();
  await expect(page.getByTestId(`board-picker-option-${board.id}`)).toContainText("Target Board");

  await page.getByTestId(`board-picker-option-${board.id}`).click();
  await expect(page.getByTestId("msg-board-status").last()).toContainText("Target Board");
  await expect(page.getByTestId("err-msg-board")).toHaveCount(0);

  // 真实写入断言：该 board 的 items 里出现一条 note，内容含 AI 回复文本。
  const itemsRes = await page.request.get(`/api/boards/${board.id}/items`);
  expect(itemsRes.ok()).toBeTruthy();
  const { items } = (await itemsRes.json()) as { items: Array<{ type: string; text: string }> };
  expect(items.some((it) => it.type === "note" && it.text.includes("这是 AVA 的 stub 回复"))).toBe(true);
});

test("发送到 Board：无编辑权限的白板不可选或提示权限不足", async ({ page }) => {
  const email = uniq();
  await register(page, email);
  await startChat(page);

  await page.getByTestId("msg-send-to-board").last().click();
  await expect(page.getByTestId("board-picker")).toBeVisible();
  // 全新用户没有任何可编辑白板：选择器展示空态，而不是报错或崩溃。
  await expect(page.getByTestId("board-picker-empty")).toBeVisible();
});

test("发送到 Board：非编辑权限 Board 调用底层接口返回 403 权限不足", async ({ playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "W", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "PrivateRoom" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Private Board" } })).json())
    .board;

  const intruder = await playwright.request.newContext({ baseURL });
  const intruderEmail = uniq();
  await intruder.post("/api/auth/register", {
    data: { firstName: "I", lastName: "N", email: intruderEmail, password: "secret123", agreeTerms: true },
  });
  const thread = (await (await intruder.post("/api/ava/threads")).json()).thread;
  const sendRes = await intruder.post(`/api/ava/threads/${thread.id}/messages`, {
    data: { text: "hi" },
  });
  expect(sendRes.ok()).toBeTruthy();
  await sendRes.body(); // 消费完 SSE stream body，确保消息已落库

  // 拿最后一条 assistant 消息 id。
  const detail = (await (await intruder.get(`/api/ava/threads/${thread.id}`)).json()) as {
    messages: Array<{ id: number; role: string }>;
  };
  const assistantMsg = detail.messages.filter((m) => m.role === "assistant").at(-1)!;

  const res = await intruder.post(
    `/api/ava/threads/${thread.id}/messages/${assistantMsg.id}/send-to-board`,
    { data: { boardId: board.id } }
  );
  expect(res.status()).toBe(403);

  await owner.dispose();
  await intruder.dispose();
});

test("发送邮件：成功发送到当前用户邮箱，独立成功提示", async ({ page }) => {
  const email = uniq();
  await register(page, email);
  await startChat(page);

  await page.getByTestId("msg-send-email").last().click();
  await expect(page.getByTestId("msg-email-status").last()).toContainText(email);
  await expect(page.getByTestId("err-msg-email")).toHaveCount(0);

  const outRes = await page.request.get(
    `/api/dev/outbox?to=${encodeURIComponent(email)}&kind=ava_message_email`
  );
  expect(outRes.ok()).toBeTruthy();
  const { mail } = (await outRes.json()) as { mail: { to_email: string; kind: string; body: string } };
  expect(mail.to_email).toBe(email);
  expect(mail.kind).toBe("ava_message_email");
  expect(mail.body).toContain("这是 AVA 的 stub 回复");
});

test("发送邮件：频控——同一分钟内连续点击第二次被拦截，不发第二封", async ({ page }) => {
  const email = uniq();
  await register(page, email);
  await startChat(page);

  await page.getByTestId("msg-send-email").last().click();
  await expect(page.getByTestId("msg-email-status").last()).toContainText(email);

  const outRes1 = await page.request.get(
    `/api/dev/outbox?to=${encodeURIComponent(email)}&kind=ava_message_email`
  );
  const mail1 = (await outRes1.json()).mail as { id: number };

  // 连续第二次点击：应被频控拦截，展示独立错误提示，而不是再发一封。
  await page.getByTestId("msg-send-email").last().click();
  await expect(page.getByTestId("err-msg-email").last()).toContainText("频繁");
  await expect(page.getByTestId("msg-email-status")).toHaveCount(0);

  const outRes2 = await page.request.get(
    `/api/dev/outbox?to=${encodeURIComponent(email)}&kind=ava_message_email`
  );
  const mail2 = (await outRes2.json()).mail as { id: number };
  expect(mail2.id).toBe(mail1.id); // 未产生新邮件
});
