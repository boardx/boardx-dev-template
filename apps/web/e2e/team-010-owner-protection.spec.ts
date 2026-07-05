import { test, expect, type APIRequestContext, type PlaywrightWorkerArgs } from "@playwright/test";

// uc-team-005 + p21-F02：team 域 owner 保护，对齐 room 域已有的 target-owner 保护写法
// （apps/web/app/api/rooms/[id]/members/[userId]/route.ts）。
// 覆盖：
//   - admin 尝试把 owner 降级为其他角色 → 403，owner 角色不变
//   - admin 尝试移除 owner → 403，owner 仍是成员
//   - admin 尝试签发 role=owner 的邀请 → 不会真的产出 owner 邀请（拒绝或强制降级为非 owner）
//   - 合法路径不受影响：owner 操作任意成员（改角色/移除）、admin 操作普通成员（改角色/移除）
type PW = PlaywrightWorkerArgs["playwright"];
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const uniq = (p = "t10") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

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

/** owner + admin + member 三角色就位的团队（admin/member 通过邀请链接加入）。 */
async function setupTeam(playwright: PW) {
  const owner = await newUserCtx(playwright, "owner");
  const admin = await newUserCtx(playwright, "admin");
  const member = await newUserCtx(playwright, "member");
  const team = (await (await owner.ctx.post("/api/teams", { data: { name: "OwnerProtectTeam" } })).json()).team;

  const adminInvite = await (await owner.ctx.post(`/api/teams/${team.id}/invites`, { data: {} })).json();
  await admin.ctx.post("/api/teams/join", { data: { token: adminInvite.token } });
  await owner.ctx.patch(`/api/teams/${team.id}/members/${admin.userId}`, { data: { role: "admin" } });

  const memberInvite = await (await owner.ctx.post(`/api/teams/${team.id}/invites`, { data: {} })).json();
  await member.ctx.post("/api/teams/join", { data: { token: memberInvite.token } });

  return { owner, admin, member, team };
}

async function disposeAll(...users: UserCtx[]) {
  for (const u of users) await u.ctx.dispose();
}

async function roleOf(ctx: APIRequestContext, teamId: number, userId: number): Promise<string | undefined> {
  const members = await (await ctx.get(`/api/teams/${teamId}/members`)).json();
  return members.members.find((m: { user_id: number; role: string }) => m.user_id === userId)?.role;
}

test("admin 尝试降级 owner → 403，owner 角色不变", async ({ playwright }) => {
  const { owner, admin, member, team } = await setupTeam(playwright);
  const res = await admin.ctx.patch(`/api/teams/${team.id}/members/${owner.userId}`, {
    data: { role: "member" },
  });
  expect(res.status()).toBe(403);
  expect(await roleOf(owner.ctx, team.id, owner.userId)).toBe("owner");
  await disposeAll(owner, admin, member);
});

test("admin 尝试移除 owner → 403，owner 仍是成员", async ({ playwright }) => {
  const { owner, admin, member, team } = await setupTeam(playwright);
  const res = await admin.ctx.delete(`/api/teams/${team.id}/members/${owner.userId}`);
  expect(res.status()).toBe(403);
  expect(await roleOf(owner.ctx, team.id, owner.userId)).toBe("owner");
  await disposeAll(owner, admin, member);
});

test("admin 尝试签发 owner 邀请 → 不产出可用的 owner 邀请", async ({ playwright }) => {
  const { owner, admin, member, team } = await setupTeam(playwright);
  const res = await admin.ctx.post(`/api/teams/${team.id}/invites`, { data: { role: "owner" } });
  // 接受「拒绝」或「强制降级为非 owner」两种实现，只要不产出 owner 邀请
  if (res.status() === 201) {
    const body = await res.json();
    expect(body.role).not.toBe("owner");

    // 即便真的有人凭这个 token 加入，加入后的角色也不能是 owner
    const stranger = await newUserCtx(playwright, "stranger");
    const join = await stranger.ctx.post("/api/teams/join", { data: { token: body.token } });
    expect(join.status()).toBe(200);
    expect(await roleOf(owner.ctx, team.id, stranger.userId)).not.toBe("owner");
    await stranger.ctx.dispose();
  } else {
    expect(res.status()).toBe(403);
  }
  await disposeAll(owner, admin, member);
});

test("合法路径不受影响：owner 可以改/移除任意成员（含 admin）", async ({ playwright }) => {
  const { owner, admin, member, team } = await setupTeam(playwright);

  const promote = await owner.ctx.patch(`/api/teams/${team.id}/members/${member.userId}`, {
    data: { role: "admin" },
  });
  expect(promote.status()).toBe(200);
  expect(await roleOf(owner.ctx, team.id, member.userId)).toBe("admin");

  const removeAdmin = await owner.ctx.delete(`/api/teams/${team.id}/members/${admin.userId}`);
  expect(removeAdmin.status()).toBe(200);
  expect(await roleOf(owner.ctx, team.id, admin.userId)).toBeUndefined();

  await disposeAll(owner, admin, member);
});

test("合法路径不受影响：admin 可以改/移除普通成员", async ({ playwright }) => {
  const { owner, admin, member, team } = await setupTeam(playwright);

  const patch = await admin.ctx.patch(`/api/teams/${team.id}/members/${member.userId}`, {
    data: { role: "admin" },
  });
  expect(patch.status()).toBe(200);
  expect(await roleOf(owner.ctx, team.id, member.userId)).toBe("admin");

  const del = await admin.ctx.delete(`/api/teams/${team.id}/members/${member.userId}`);
  expect(del.status()).toBe(200);
  expect(await roleOf(owner.ctx, team.id, member.userId)).toBeUndefined();

  await disposeAll(owner, admin, member);
});
