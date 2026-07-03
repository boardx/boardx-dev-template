import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// uc-rr-006 房间权限矩阵统一（p20/F07）
// 按权威矩阵逐行断言（每行至少一个正/反用例）：
//   查看/创建（member ✅）、邀请/移除 member（admin ✅ / member ❌）、
//   提升/降级 admin（owner ✅ / admin ❌）、移除 admin（owner ✅）、
//   改名/可见性（admin ✅ / member ❌）、删房间/动 owner（admin ❌）。
// 注：删除他人文件行的 API 由 p20/F03（房间文件库）交付，端点就绪后在 F03 的 e2e 断言。
// 与 room-003 spec 互补：本文件不重复「admin 移除 admin 403」「owner 不可自移除」断言。
const uniq = (p = "rr7") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

interface UserCtx {
  ctx: APIRequestContext;
  email: string;
  userId: number;
}

async function newUserCtx(playwright: any, prefix = "u"): Promise<UserCtx> {
  const email = uniq(prefix);
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, email, userId: reg.user.id };
}

/** owner + admin + member 三角色就位的房间。 */
async function setupRoom(playwright: any) {
  const owner = await newUserCtx(playwright, "owner");
  const admin = await newUserCtx(playwright, "admin");
  const member = await newUserCtx(playwright, "member");
  const room = (
    await (await owner.ctx.post("/api/rooms", { data: { name: "MatrixRoom", visibility: "private" } })).json()
  ).room;
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: admin.userId } });
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  await owner.ctx.patch(`/api/rooms/${room.id}/members/${admin.userId}`, { data: { role: "admin" } });
  return { owner, admin, member, room };
}

async function disposeAll(...users: UserCtx[]) {
  for (const u of users) await u.ctx.dispose();
}

test("矩阵：查看与创建 — member 可看房间/成员/boards/chats，可建 board 和 chat", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  // 查看（member ✅）
  expect((await member.ctx.get(`/api/rooms/${room.id}`)).status()).toBe(200);
  expect((await member.ctx.get(`/api/rooms/${room.id}/members`)).status()).toBe(200);
  expect((await member.ctx.get(`/api/rooms/${room.id}/boards`)).status()).toBe(200);
  expect((await member.ctx.get(`/api/rooms/${room.id}/chats`)).status()).toBe(200);

  // 创建 board / chat（member ✅）
  expect((await member.ctx.post(`/api/rooms/${room.id}/boards`, { data: { name: "MB" } })).status()).toBe(201);
  expect((await member.ctx.post(`/api/rooms/${room.id}/chats`, { data: { name: "MC" } })).status()).toBe(201);

  await disposeAll(owner, admin, member);
});

test("矩阵：邀请/移除 member — admin ✅，member ❌(403)", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);
  const extra = await newUserCtx(playwright, "extra");

  // member 邀请 → 403
  expect(
    (await member.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: extra.userId } })).status()
  ).toBe(403);
  // member 移除他人 → 403
  expect((await member.ctx.delete(`/api/rooms/${room.id}/members/${admin.userId}`)).status()).toBe(403);

  // admin 邀请 member → 成功
  expect(
    (await admin.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: extra.userId } })).status()
  ).toBe(201);
  // admin 移除 member → 成功
  expect((await admin.ctx.delete(`/api/rooms/${room.id}/members/${extra.userId}`)).status()).toBe(200);

  await disposeAll(owner, admin, member, extra);
});

test("矩阵：提升/降级 admin — owner ✅，admin ❌(403)，member ❌(403)", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  // admin 试图提升 member 为 admin → 403（涉及 admin 角色变更，仅 owner）
  expect(
    (await admin.ctx.patch(`/api/rooms/${room.id}/members/${member.userId}`, { data: { role: "admin" } })).status()
  ).toBe(403);
  // admin 试图降级另一个 admin → 403
  const admin2 = await newUserCtx(playwright, "admin2");
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: admin2.userId } });
  await owner.ctx.patch(`/api/rooms/${room.id}/members/${admin2.userId}`, { data: { role: "admin" } });
  expect(
    (await admin.ctx.patch(`/api/rooms/${room.id}/members/${admin2.userId}`, { data: { role: "member" } })).status()
  ).toBe(403);
  // member 改任何人角色 → 403
  expect(
    (await member.ctx.patch(`/api/rooms/${room.id}/members/${admin.userId}`, { data: { role: "member" } })).status()
  ).toBe(403);

  // owner 提升 member → admin，再降回 member → 成功
  expect(
    (await owner.ctx.patch(`/api/rooms/${room.id}/members/${member.userId}`, { data: { role: "admin" } })).status()
  ).toBe(200);
  expect(
    (await owner.ctx.patch(`/api/rooms/${room.id}/members/${member.userId}`, { data: { role: "member" } })).status()
  ).toBe(200);
  // owner 移除 admin → 成功（移除 admin 行的正用例）
  expect((await owner.ctx.delete(`/api/rooms/${room.id}/members/${admin2.userId}`)).status()).toBe(200);

  await disposeAll(owner, admin, member, admin2);
});

test("矩阵：改房间名/可见性 — owner ✅，admin ✅（新放宽），member ❌(403)", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  // admin PATCH 改名 + 可见性 → 成功（本 feature 的核心放宽点）
  const adminPatch = await admin.ctx.patch(`/api/rooms/${room.id}`, {
    data: { name: "RenamedByAdmin", visibility: "team" },
  });
  expect(adminPatch.status()).toBe(200);
  const after = await (await admin.ctx.get(`/api/rooms/${room.id}`)).json();
  expect(after.room.name).toBe("RenamedByAdmin");
  expect(after.room.visibility).toBe("team");

  // owner PATCH 仍然成功
  expect((await owner.ctx.patch(`/api/rooms/${room.id}`, { data: { name: "RenamedByOwner" } })).status()).toBe(200);

  // member PATCH → 403
  expect((await member.ctx.patch(`/api/rooms/${room.id}`, { data: { name: "hack" } })).status()).toBe(403);

  await disposeAll(owner, admin, member);
});

test("矩阵：删除房间 / 动 owner — admin ❌(403)，member ❌(403)，owner ✅", async ({ playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  // admin 删房间 → 403
  expect((await admin.ctx.delete(`/api/rooms/${room.id}`)).status()).toBe(403);
  // member 删房间 → 403
  expect((await member.ctx.delete(`/api/rooms/${room.id}`)).status()).toBe(403);

  // admin 试图移除 owner → 403；admin 试图改 owner 角色 → 403
  expect((await admin.ctx.delete(`/api/rooms/${room.id}/members/${owner.userId}`)).status()).toBe(403);
  expect(
    (await admin.ctx.patch(`/api/rooms/${room.id}/members/${owner.userId}`, { data: { role: "member" } })).status()
  ).toBe(403);
  // owner 也不能把自己（owner）降级 → 403
  expect(
    (await owner.ctx.patch(`/api/rooms/${room.id}/members/${owner.userId}`, { data: { role: "member" } })).status()
  ).toBe(403);

  // owner 删房间 → 成功
  expect((await owner.ctx.delete(`/api/rooms/${room.id}`)).status()).toBe(200);

  await disposeAll(owner, admin, member);
});

async function loginOnPage(page: Page, email: string) {
  await page.goto("/login");
  const res = await page.request.post("/api/auth/login", { data: { email, password: "secret123" } });
  expect(res.ok()).toBeTruthy();
}

test("UI：admin 在成员页看到邀请区，但看不到角色下拉；admin 行无移除按钮，member 行有", async ({
  page,
  playwright,
}) => {
  const { owner, admin, member, room } = await setupRoom(playwright);
  const admin2 = await newUserCtx(playwright, "admin2");
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: admin2.userId } });
  await owner.ctx.patch(`/api/rooms/${room.id}/members/${admin2.userId}`, { data: { role: "admin" } });

  await loginOnPage(page, admin.email);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();

  // admin 可邀请
  await expect(page.getByTestId("invite-section")).toBeVisible();
  // admin 不可提升/降级 → 任何行都没有角色下拉
  await expect(page.getByTestId(`role-select-${member.userId}`)).toHaveCount(0);
  await expect(page.getByTestId(`role-select-${admin2.userId}`)).toHaveCount(0);
  // admin 可移除 member，不可移除 admin/owner
  await expect(page.getByTestId(`remove-${member.userId}`)).toBeVisible();
  await expect(page.getByTestId(`remove-${admin2.userId}`)).toHaveCount(0);
  await expect(page.getByTestId(`remove-${owner.userId}`)).toHaveCount(0);

  await disposeAll(owner, admin, member, admin2);
});

test("UI：member 在成员页看不到任何管理控件（邀请/角色/移除）", async ({ page, playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  await loginOnPage(page, member.email);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();

  await expect(page.getByTestId("invite-section")).toHaveCount(0);
  await expect(page.getByTestId(`role-select-${admin.userId}`)).toHaveCount(0);
  await expect(page.getByTestId(`remove-${admin.userId}`)).toHaveCount(0);
  await expect(page.getByTestId(`remove-${owner.userId}`)).toHaveCount(0);

  await disposeAll(owner, admin, member);
});

test("UI：owner 在成员页对非 owner 行看到角色下拉与移除按钮", async ({ page, playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);

  await loginOnPage(page, owner.email);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();

  await expect(page.getByTestId(`role-select-${admin.userId}`)).toBeVisible();
  await expect(page.getByTestId(`role-select-${member.userId}`)).toBeVisible();
  await expect(page.getByTestId(`remove-${admin.userId}`)).toBeVisible();
  // owner 自己的行没有移除按钮
  await expect(page.getByTestId(`remove-${owner.userId}`)).toHaveCount(0);

  await disposeAll(owner, admin, member);
});
