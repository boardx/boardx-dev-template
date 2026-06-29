import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `tij_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("owner 邀请、被邀请人加入为 member", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = await (await owner.post("/api/teams", { data: { name: "Inv Team" } })).json();
  const invite = await (await owner.post(`/api/teams/${team.team.id}/invites`, { data: {} })).json();
  expect(invite.token).toBeTruthy();

  const guest = await newUser(playwright);
  const join = await guest.post("/api/teams/join", { data: { token: invite.token } });
  expect(join.status()).toBe(200);
  const joinBody = await join.json();
  expect(joinBody.role).toBe("member");

  // owner 查看成员应有 2 人
  const members = await (await owner.get(`/api/teams/${team.team.id}/members`)).json();
  expect(members.members.length).toBe(2);

  await owner.dispose();
  await guest.dispose();
});

test("非 owner/admin（member）无权邀请 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = await (await owner.post("/api/teams", { data: { name: "T" } })).json();
  const invite = await (await owner.post(`/api/teams/${team.team.id}/invites`, { data: {} })).json();
  const member = await newUser(playwright);
  await member.post("/api/teams/join", { data: { token: invite.token } });
  // member 尝试邀请 → 403
  const res = await member.post(`/api/teams/${team.team.id}/invites`, { data: {} });
  expect(res.status()).toBe(403);
  await owner.dispose();
  await member.dispose();
});

test("无效令牌加入 → 400", async ({ playwright }) => {
  const u = await newUser(playwright);
  const res = await u.post("/api/teams/join", { data: { token: "bogus" } });
  expect(res.status()).toBe(400);
  await u.dispose();
});
