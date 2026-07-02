import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function newUser(playwright: any): Promise<{ ctx: APIRequestContext; userId: number }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  })).json();
  return { ctx, userId: reg.user.id };
}

test("owner 加/移成员、改名改可见性、删除；非 owner 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "R", visibility: "private" } })).json()).room;
  const guest = await newUser(playwright);

  // owner 加成员
  const add = await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: guest.userId } });
  expect(add.status()).toBe(201);
  // 成员现在可见
  expect((await guest.ctx.get(`/api/rooms/${room.id}`)).status()).toBe(200);

  // 改名 + 改可见性
  expect((await owner.ctx.patch(`/api/rooms/${room.id}`, { data: { name: "R2", visibility: "team" } })).status()).toBe(200);

  // 非 owner（guest）管理操作 403
  expect((await guest.ctx.patch(`/api/rooms/${room.id}`, { data: { name: "hack" } })).status()).toBe(403);
  expect((await guest.ctx.delete(`/api/rooms/${room.id}`)).status()).toBe(403);

  // owner 移除成员
  expect((await owner.ctx.delete(`/api/rooms/${room.id}/members/${guest.userId}`)).status()).toBe(200);

  // owner 删除房间
  expect((await owner.ctx.delete(`/api/rooms/${room.id}`)).status()).toBe(200);

  await owner.ctx.dispose();
  await guest.ctx.dispose();
});
