import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `rv_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("私有房间对非成员不可见、未授权访问 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;

  const outsider = await newUser(playwright);
  // 列表不含他人私有房间
  const list = await (await outsider.get("/api/rooms")).json();
  expect(list.rooms.some((r: { id: number }) => String(r.id) === String(room.id))).toBe(false);
  // 直接访问 403
  const direct = await outsider.get(`/api/rooms/${room.id}`);
  expect(direct.status()).toBe(403);

  await owner.dispose();
  await outsider.dispose();
});

test("关键字搜索房间", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.request.post("/api/rooms", { data: { name: "Alpha Room" } });
  await page.request.post("/api/rooms", { data: { name: "Beta Room" } });
  const res = await page.request.get("/api/rooms?q=Alpha");
  const data = await res.json();
  expect(data.rooms.length).toBe(1);
  expect(data.rooms[0].name).toBe("Alpha Room");
});
