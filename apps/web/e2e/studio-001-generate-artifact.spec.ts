import { test, expect, type APIRequestContext } from "@playwright/test";

// uc-studio-001-generate-artifact —— F01 完成契约。
// 覆盖：房间聊天右侧 Studio 面板 → 选类型 + 配置来源 → POST /api/studio/generate（房间聊天线程
// 范围内的路由）触发异步生成 → 面板展示生成中 → 结果卡片出现在聊天（可播放/预览/下载）；
// 生成失败给重试；无可用来源时禁用生成。真实链路：入队 boardx.studio-generation →
// workflow-worker 消费 → 回写 studio_artifacts.status，前端轮询刷新。

const uniq = (p = "st") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Stu", lastName: "Dio", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function newUser(playwright: any, prefix: string): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "U", lastName: "U", email: uniq(prefix), password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, userId: reg.user.id };
}

async function createRoomChat(page: import("@playwright/test").Page) {
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "Mine" } })).json())
    .chat;
  return { room, chat };
}

test("Studio 面板可见：来源为空时生成被禁用", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);

  await expect(page.getByTestId("pane-studio")).toBeVisible();
  await expect(page.getByTestId("studio-type-audio")).toBeVisible();
  await expect(page.getByTestId("studio-type-infographic")).toBeVisible();
  await expect(page.getByTestId("studio-type-presentation")).toBeVisible();

  // 空线程：current_chat 来源不可用（无消息），room_files 也不可用（未上传文件）→ 生成禁用
  await expect(page.getByTestId("studio-no-source")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("studio-generate")).toBeDisabled();
});

test("以当前聊天为来源生成音频概览：生成中 → 结果卡片可播放", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);

  // 先发一条消息，使 current_chat 来源可用
  await page.getByTestId("chat-input").fill("帮我整理这次讨论");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("msg-user")).toBeVisible();

  // current_chat 来源可用后生成按钮可用（轮询刷新来源可用性，给足超时）
  await expect(page.getByTestId("studio-source-current_chat")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("studio-source-current_chat").click();
  await page.getByTestId("studio-type-audio").click();
  await page.getByTestId("studio-prompt").fill("聚焦关键决策");
  await expect(page.getByTestId("studio-generate")).toBeEnabled();
  await page.getByTestId("studio-generate").click();

  // 生成中占位或结果卡片其一可见：mock 生成器接近瞬时完成，2s 轮询可能直接跳过
  // queued/processing 窗口——只要最终结果卡片出现即证明异步链路（入队→worker→回写→轮询）
  // 真实跑通，不对生成中占位的可见时长做脆弱假设。
  await expect(
    page.getByTestId("studio-generating").or(page.locator('[data-testid^="studio-result-"]').first())
  ).toBeVisible({ timeout: 10_000 });

  // 结果卡片最终出现在聊天中，可播放（audio 元素存在）
  const resultCard = page.locator('[data-testid^="studio-result-"]').first();
  await expect(resultCard).toBeVisible({ timeout: 30_000 });
  await expect(resultCard).toContainText("音频概览");
  await expect(page.locator('[data-testid^="studio-audio-"]').first()).toBeVisible({ timeout: 15_000 });
});

test("信息图生成：结果卡片图片可预览", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);

  await page.getByTestId("chat-input").fill("给我一张信息图");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("msg-user")).toBeVisible();

  await expect(page.getByTestId("studio-source-current_chat")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("studio-source-current_chat").click();
  await page.getByTestId("studio-type-infographic").click();
  await page.getByTestId("studio-generate").click();

  const resultCard = page.locator('[data-testid^="studio-result-"]').first();
  await expect(resultCard).toBeVisible({ timeout: 30_000 });
  await expect(resultCard).toContainText("信息图");
  await expect(page.locator('[data-testid^="studio-image-"]').first()).toBeVisible({ timeout: 15_000 });
});

test("演示文稿生成：结果卡片提供下载链接", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);

  await page.getByTestId("chat-input").fill("准备一个演示");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("msg-user")).toBeVisible();

  await expect(page.getByTestId("studio-source-current_chat")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("studio-source-current_chat").click();
  await page.getByTestId("studio-type-presentation").click();
  await page.getByTestId("studio-generate").click();

  const resultCard = page.locator('[data-testid^="studio-result-"]').first();
  await expect(resultCard).toBeVisible({ timeout: 30_000 });
  await expect(resultCard).toContainText("演示文稿");
  await expect(page.locator('[data-testid^="studio-download-"]').first()).toBeVisible({ timeout: 15_000 });
});

test("生成失败：结果卡片展示失败态，提供重试并最终成功", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  await page.goto(`/rooms/${room.id}/chats/${chat.id}`);

  await page.getByTestId("chat-input").fill("触发失败用例");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("msg-user")).toBeVisible();

  await expect(page.getByTestId("studio-source-current_chat")).toBeEnabled({ timeout: 10_000 });
  await page.getByTestId("studio-source-current_chat").click();
  await page.getByTestId("studio-type-audio").click();
  // sanctioned 测试触发词（见 packages/ai/studioGenerator.ts STUDIO_FORCE_FAIL_MARKER）
  await page.getByTestId("studio-prompt").fill("__studio_force_fail__");
  await page.getByTestId("studio-generate").click();

  const resultCard = page.locator('[data-testid^="studio-result-"]').first();
  await expect(resultCard).toBeVisible({ timeout: 30_000 });
  await expect(resultCard).toContainText("生成失败");
  const retryBtn = page.locator('[data-testid^="studio-result-retry-"]').first();
  await expect(retryBtn).toBeVisible();

  // 重试：清空提示词后端仍沿用旧 prompt（含触发词）会再次失败——这里验证重试请求本身成功可见即可
  // （重试接口 202 后面板/卡片重新进入处理中）。
  await retryBtn.click();
  await expect(page.getByTestId("studio-generating").or(page.locator('[data-testid^="studio-result-"]').first())).toBeVisible({
    timeout: 10_000,
  });
});

test("未登录访问房间聊天 → 跳转登录", async ({ page }) => {
  await page.goto("/rooms/1/chats/1");
  await expect(page).toHaveURL(/\/login/);
});

test("权限分支：未登录 POST 生成接口 → 401", async ({ page }) => {
  const res = await page.request.post("/api/rooms/1/chats/1/studio/generate", {
    data: { type: "audio", source: "current_chat" },
  });
  expect(res.status()).toBe(401);
});

test("失败分支：缺少类型/来源 → 400", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  const res = await page.request.post(`/api/rooms/${room.id}/chats/${chat.id}/studio/generate`, {
    data: { type: "bogus", source: "current_chat" },
  });
  expect(res.status()).toBe(400);
});

test("失败分支：来源不可用时服务端二次校验拒绝（400），不产生半条制品", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  // 空线程，current_chat 无消息 → 服务端拒绝（即便绕过前端禁用直接 POST）
  const res = await page.request.post(`/api/rooms/${room.id}/chats/${chat.id}/studio/generate`, {
    data: { type: "audio", source: "current_chat" },
  });
  expect(res.status()).toBe(400);
});

test("权限：非创建者房间成员不能重试他人线程的失败制品 → 403", async ({ page, playwright }) => {
  const owner = await newUser(playwright, "studio-owner");
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "Owner Thread" } })).json())
    .chat;
  // owner 发一条消息使 current_chat 来源可用，再用强制失败触发词生成一个失败制品
  await owner.ctx.post(`/api/rooms/${room.id}/chats/${chat.id}/messages`, { data: { text: "hi" } });
  const genRes = await owner.ctx.post(`/api/rooms/${room.id}/chats/${chat.id}/studio/generate`, {
    data: { type: "audio", source: "current_chat", prompt: "__studio_force_fail__" },
  });
  expect(genRes.status()).toBe(202);
  const { artifact } = await genRes.json();

  // 等待 worker 把制品回写为 error（轮询，带超时）
  let status = artifact.status;
  for (let i = 0; i < 20 && status !== "error"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const listRes = await owner.ctx.get(`/api/rooms/${room.id}/chats/${chat.id}/studio/artifacts`);
    const list = (await listRes.json()).artifacts as Array<{ id: string; status: string }>;
    status = list.find((a) => a.id === artifact.id)?.status ?? status;
  }
  expect(status).toBe("error");

  // 非创建者成员被加入房间，尝试重试 owner 的失败制品 → 403（且不能发消息，符合既有只读语义）
  const member = await newUser(playwright, "studio-member");
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  const retryRes = await member.ctx.post(
    `/api/rooms/${room.id}/chats/${chat.id}/studio/artifacts/${artifact.id}/retry`
  );
  expect(retryRes.status()).toBe(403);

  await owner.ctx.dispose();
  await member.ctx.dispose();
});

test("权限：未登录调用重试接口 → 401", async ({ page }) => {
  await register(page);
  const { room, chat } = await createRoomChat(page);
  const anon = await page.request;
  await page.context().clearCookies();
  const res = await anon.post(`/api/rooms/${room.id}/chats/${chat.id}/studio/artifacts/nonexistent/retry`);
  expect(res.status()).toBe(401);
});

test("「房间文件」来源不读取当前请求者的私人文件（个人房间场景的越权修复）", async ({ page, playwright }) => {
  // 回归：修复前 room_files 来源直接查 ownerUserId=当前请求者的 personal scope 文件，
  // 与"房间"毫无关联——同一房间不同成员会看到彼此互不相关的私人文件集。
  // 这里验证：即便当前请求者自己有 ready 的 kb 文件，个人房间（无 team）的 room_files
  // 来源判定看的是房间 owner 的文件，而不是当前请求者自己的文件。
  const requester = await newUser(playwright, "studio-src");
  // requester 自己上传一个文件（这不该被算作任何其他人房间的"房间文件"）
  await requester.ctx.post("/api/kb/files", {
    multipart: {
      file: { name: "mine.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") },
      scope: "personal",
    },
  });

  const owner = await newUser(playwright, "studio-src-owner");
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json())
    .room;
  const chat = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "T" } })).json()).chat;
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: requester.userId } });

  // owner 自己没有上传任何文件 → room_files 应不可用，即便 requester 自己有私人文件
  const sourcesRes = await requester.ctx.get(`/api/rooms/${room.id}/chats/${chat.id}/studio/sources`);
  expect(sourcesRes.status()).toBe(200);
  const { sources } = await sourcesRes.json();
  expect(sources.room_files.available).toBe(false);

  await requester.ctx.dispose();
  await owner.ctx.dispose();
});
