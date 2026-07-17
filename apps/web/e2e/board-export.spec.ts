import { expect, test } from "@playwright/test";

// #638 headless 导出能力：/api/boards/:id/export?format=pdf|svg 端到端证明产物非空。
// 解锁 p7-F09（幻灯片导出 PDF）/ p7-F15（导出选中 = ?ids= 子集）。
const uniq = () => `exp_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createBoardWithItems(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ex", lastName: "Port", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Export Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Export Board" } })).json()).board;
  // 放两个图元，导出产物应非空且包含它们
  const it1 = (await (await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "note", x: 40, y: 40, text: "导出内容-A" } })).json());
  await page.request.post(`/api/boards/${board.id}/items`, { data: { type: "rect", x: 200, y: 120, text: "B" } });
  return { board, firstItemId: it1?.item?.id ?? it1?.id };
}

test("导出 PDF：端点返回非空 application/pdf（%PDF 魔数）", async ({ page }) => {
  const { board } = await createBoardWithItems(page);
  const res = await page.request.get(`/api/boards/${board.id}/export?format=pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.length).toBeGreaterThan(500);
  expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("导出 SVG：端点返回非空 image/svg+xml，含画布文字", async ({ page }) => {
  const { board } = await createBoardWithItems(page);
  const res = await page.request.get(`/api/boards/${board.id}/export?format=svg`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/svg+xml");
  const text = await res.text();
  expect(text.startsWith("<svg")).toBe(true);
  expect(text).toContain("导出内容-A");
});

test("不支持的格式 → 400；不存在的板 → 404", async ({ page }) => {
  const { board } = await createBoardWithItems(page);
  expect((await page.request.get(`/api/boards/${board.id}/export?format=xlsx`)).status()).toBe(400);
  expect((await page.request.get(`/api/boards/99999999/export?format=pdf`)).status()).toBe(404);
});
