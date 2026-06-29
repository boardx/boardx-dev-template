import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `tm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

async function ownerWithMember(playwright: any) {
  const owner = await newUser(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Mng" } })).json()).team;
  const invite = await (await owner.post(`/api/teams/${team.id}/invites`, { data: {} })).json();
  const member = await newUser(playwright);
  const join = await (await member.post("/api/teams/join", { data: { token: invite.token } })).json();
  const memberUserId = join.teamId ? undefined : undefined; // filled below
  const members = await (await owner.get(`/api/teams/${team.id}/members`)).json();
  const memberRow = members.members.find((m: { role: string }) => m.role === "member");
  return { owner, member, team, memberUserId: memberRow.user_id };
}

test("owner 改成员角色、移除成员", async ({ playwright }) => {
  const { owner, member, team, memberUserId } = await ownerWithMember(playwright);
  // 改为 admin
  const patch = await owner.patch(`/api/teams/${team.id}/members/${memberUserId}`, { data: { role: "admin" } });
  expect(patch.status()).toBe(200);
  // 移除成员
  const del = await owner.delete(`/api/teams/${team.id}/members/${memberUserId}`);
  expect(del.status()).toBe(200);
  const members = await (await owner.get(`/api/teams/${team.id}/members`)).json();
  expect(members.members.length).toBe(1);
  await owner.dispose();
  await member.dispose();
});

test("member 无权管理（改角色 403），非 owner 无权删除团队（403）", async ({ playwright }) => {
  const { owner, member, team, memberUserId } = await ownerWithMember(playwright);
  // member 尝试改角色 → 403
  const patch = await member.patch(`/api/teams/${team.id}/members/${memberUserId}`, { data: { role: "owner" } });
  expect(patch.status()).toBe(403);
  // member 尝试删团队 → 403
  const del = await member.delete(`/api/teams/${team.id}`);
  expect(del.status()).toBe(403);
  await owner.dispose();
  await member.dispose();
});

test("owner 改名并删除团队", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Old" } })).json()).team;
  const rename = await owner.patch(`/api/teams/${team.id}`, { data: { name: "New Name" } });
  expect(rename.status()).toBe(200);
  const del = await owner.delete(`/api/teams/${team.id}`);
  expect(del.status()).toBe(200);
  await owner.dispose();
});
