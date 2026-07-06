import { test, expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

// uc-rr-010 / p20-F11「Room AI 上下文字段回补（description + ai_instruction）」。
// 权限断言口径与 room-rr-007（F07 权限矩阵）一致：PATCH /api/rooms/[id] 走同一
// canManageRoom 判定，owner/admin 可改、member 403 —— 复用其 owner/admin/member 三角色
// setup helper（本仓无共享 e2e helper 模块，按约定内联复制，不重新发明权限判定）。
type PW = PlaywrightWorkerArgs["playwright"];
const uniq = (p = "rr11") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

interface UserCtx {
  ctx: APIRequestContext;
  email: string;
  userId: number;
}

async function newUserCtx(playwright: PW, prefix = "u"): Promise<UserCtx> {
  const email = uniq(prefix);
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, email, userId: reg.user.id };
}

/** owner + admin + member 三角色就位的房间（与 room-rr-007 setupRoom 一致）。 */
async function setupRoom(playwright: PW) {
  const owner = await newUserCtx(playwright, "owner");
  const admin = await newUserCtx(playwright, "admin");
  const member = await newUserCtx(playwright, "member");
  const room = (
    await (await owner.ctx.post("/api/rooms", { data: { name: "AiContextRoom", visibility: "private" } })).json()
  ).room;
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: admin.userId } });
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  await owner.ctx.patch(`/api/rooms/${room.id}/members/${admin.userId}`, { data: { role: "admin" } });
  return { owner, admin, member, room };
}

async function disposeAll(...users: UserCtx[]) {
  for (const u of users) await u.ctx.dispose();
}

async function loginOnPage(page: Page, email: string) {
  await page.goto("/login");
  const res = await page.request.post("/api/auth/login", { data: { email, password: "secret123" } });
  expect(res.ok()).toBeTruthy();
}

test("owner/admin 可 PATCH 保存 description + ai_instruction；字段持久化", async ({ playwright }) => {
  const { owner, admin, room } = await setupRoom(playwright);

  const patchByOwner = await owner.ctx.patch(`/api/rooms/${room.id}`, {
    data: { description: "这是团队的协作房间", ai_instruction: "回复时使用简体中文，语气正式" },
  });
  expect(patchByOwner.status()).toBe(200);

  const afterOwner = await (await owner.ctx.get(`/api/rooms/${room.id}`)).json();
  expect(afterOwner.room.description).toBe("这是团队的协作房间");
  expect(afterOwner.room.ai_instruction).toBe("回复时使用简体中文，语气正式");

  // admin 也可修改（与 F07 矩阵放宽口径一致）
  const patchByAdmin = await admin.ctx.patch(`/api/rooms/${room.id}`, {
    data: { description: "admin 更新的描述" },
  });
  expect(patchByAdmin.status()).toBe(200);
  const afterAdmin = await (await admin.ctx.get(`/api/rooms/${room.id}`)).json();
  expect(afterAdmin.room.description).toBe("admin 更新的描述");

  await disposeAll(owner, admin);
});

test("member 直调 PATCH 改 description/ai_instruction → 403（与 F07 权限矩阵口径一致）", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  const res = await member.ctx.patch(`/api/rooms/${room.id}`, {
    data: { description: "hack", ai_instruction: "hack" },
  });
  expect(res.status()).toBe(403);

  await disposeAll(owner, admin, member);
});

test("ai_instruction 超过 4000 字符 → 400 校验拒绝", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  const tooLong = "A".repeat(4001);
  const res = await owner.ctx.patch(`/api/rooms/${room.id}`, { data: { ai_instruction: tooLong } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.errors?.ai_instruction).toBeTruthy();

  await disposeAll(owner, admin, member);
});

test("房间任一聊天线程发消息，ai_instruction 注入系统提示（桩层断言注入内容，非模型效果验证）；同房间全部线程共享同一指令", async ({
  playwright,
}) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  const instruction = "请始终以「小助手」自称";
  await owner.ctx.patch(`/api/rooms/${room.id}`, { data: { ai_instruction: instruction } });

  // 房主创建两个线程
  const chatA = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "线程A" } })).json())
    .chat;
  const chatB = (await (await owner.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "线程B" } })).json())
    .chat;

  const msgA = await (
    await owner.ctx.post(`/api/rooms/${room.id}/chats/${chatA.id}/messages`, { data: { text: "你好" } })
  ).json();
  const msgB = await (
    await owner.ctx.post(`/api/rooms/${room.id}/chats/${chatB.id}/messages`, { data: { text: "在吗" } })
  ).json();

  // 桩层断言：注入内容能在两条线程的助手回复里被断言到（同房间全部线程共享同一指令）
  expect(msgA.replyMessage.content).toContain(instruction);
  expect(msgB.replyMessage.content).toContain(instruction);

  await disposeAll(owner, admin, member);
});

test("UI：owner 在 Members 页 About & AI 区块编辑并保存后，字段持久化 + 房间页头展示 description", async ({
  page,
  playwright,
}) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  await loginOnPage(page, owner.email);
  await page.goto(`/rooms/${room.id}/members`);

  await expect(page.getByTestId("room-about-ai-section")).toBeVisible();
  await page.getByTestId("room-settings-description").fill("这是 UI 保存的描述");
  await page.getByTestId("room-settings-ai-instruction").fill("请用友好的语气回复");
  await page.getByTestId("room-about-ai-save").click();
  await expect(page.getByTestId("room-about-ai-saved")).toBeVisible();

  // 服务端确认持久化
  const after = await (await owner.ctx.get(`/api/rooms/${room.id}`)).json();
  expect(after.room.description).toBe("这是 UI 保存的描述");
  expect(after.room.ai_instruction).toBe("请用友好的语气回复");

  // 房间详情页头展示 description
  await page.goto(`/rooms/${room.id}/boards`);
  await expect(page.getByTestId("room-header-description")).toHaveText("这是 UI 保存的描述");

  await disposeAll(owner, admin, member);
});

test("UI：ai_instruction 超长时行内提示，保存按钮禁用", async ({ page, playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  await loginOnPage(page, owner.email);
  await page.goto(`/rooms/${room.id}/members`);

  await expect(page.getByTestId("room-about-ai-section")).toBeVisible();
  await page.getByTestId("room-settings-ai-instruction").fill("A".repeat(4001));
  await expect(page.getByTestId("room-settings-ai-instruction-count")).toHaveText("4001 / 4000");
  await expect(page.getByTestId("room-about-ai-save")).toBeDisabled();

  await disposeAll(owner, admin, member);
});

test("UI：member 在 Members 页看不到 About & AI 区块", async ({ page, playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  await loginOnPage(page, member.email);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();
  await expect(page.getByTestId("room-about-ai-section")).toHaveCount(0);

  await disposeAll(owner, admin, member);
});
