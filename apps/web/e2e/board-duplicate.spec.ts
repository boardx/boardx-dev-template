import { test, expect, type APIRequestContext } from "@playwright/test";

const uniq = () => `bd_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

test("复制白板生成带副本后缀的新板（API）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Orig" } })).json()).board;
  // 元信息经 PATCH 设置（创建接口只取 name）
  await page.request.patch(`/api/boards/${board.id}`, { data: { category: "x" } });

  const res = await page.request.post(`/api/boards/${board.id}/duplicate`);
  expect(res.status()).toBe(201);
  const { board: copy } = await res.json();
  expect(copy.name).toBe("Orig（副本）");
  expect(copy.category).toBe("x");
  expect(String(copy.id)).not.toBe(String(board.id));

  const list = (await (await page.request.get(`/api/boards?roomId=${room.id}`)).json()).boards;
  expect(list.length).toBe(2);
});

test("非房间成员复制 → 403", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "Secret", visibility: "private" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "P" } })).json()).board;

  const outsider = await newUser(playwright);
  const res = await outsider.post(`/api/boards/${board.id}/duplicate`);
  expect(res.status()).toBe(403);

  await owner.dispose();
  await outsider.dispose();
});

test("UI：点复制后列表多出副本", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Dup Me" } })).json()).board;

  await page.goto(`/rooms/${room.id}/boards`);
  await page.getByTestId(`dup-${board.id}`).click();
  await expect(page.getByTestId("board-list")).toContainText("Dup Me（副本）");
});
