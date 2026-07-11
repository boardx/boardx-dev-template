import { test, expect, type Page } from "@playwright/test";

async function register(page: Page): Promise<void> {
  const email = `pubidfix_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "P", lastName: "I", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
}

test("建 room/board/duplicate 不再撞 public_id NOT NULL(复现用户报错场景)", async ({ page }) => {
  await register(page);

  // 用户的确切失败动作:新建 room(private)
  const r1 = await page.request.post("/api/rooms", { data: { name: "sdkfjkdjf", visibility: "private" } });
  expect(r1.status()).toBe(201);
  const roomId = (await r1.json()).room.id;

  // team 可见性也建一个
  const r2 = await page.request.post("/api/rooms", { data: { name: "team room", visibility: "team" } });
  expect(r2.status()).toBe(201);

  // 建 board(createBoard 路径)
  const b = await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name: "板", tags: ["x"] } });
  expect(b.status()).toBe(201);
  const boardId = (await b.json()).board.id;

  // 复制 board(duplicateBoard 路径)
  const dup = await page.request.post(`/api/boards/${boardId}/duplicate`);
  expect(dup.ok()).toBe(true);

  // 列表能正常返回(读路径不受影响)
  const list = await page.request.get(`/api/rooms/${roomId}/boards`);
  expect(list.ok()).toBe(true);
  expect((await list.json()).boards.length).toBeGreaterThanOrEqual(2);
});
