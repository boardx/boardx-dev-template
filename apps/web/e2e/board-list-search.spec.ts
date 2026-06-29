import { test, expect } from "@playwright/test";

const uniq = () => `bl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: any) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("按名称搜索房间内白板（API）", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Alpha Board" } });
  await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Beta Board" } });

  const res = await page.request.get(`/api/boards?roomId=${room.id}&q=Alpha`);
  const data = await res.json();
  expect(data.boards.length).toBe(1);
  expect(data.boards[0].name).toBe("Alpha Board");
});

test("打开白板写入最近访问，scope=recent 返回它", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Visited Board" } })).json()).board;

  // 访问前最近列表为空
  let recent = await (await page.request.get("/api/boards?scope=recent")).json();
  expect(recent.boards.length).toBe(0);

  // 打开白板（记录访问）
  await page.request.get(`/api/boards/${board.id}`);

  recent = await (await page.request.get("/api/boards?scope=recent")).json();
  expect(recent.boards.some((b: { id: number }) => String(b.id) === String(board.id))).toBe(true);
});

test("UI：搜索过滤房间白板列表", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Gamma Board" } });
  await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Delta Board" } });

  await page.goto(`/rooms/${room.id}/boards`);
  await expect(page.getByTestId("board-list")).toContainText("Gamma Board");
  await page.getByTestId("search").fill("Delta");
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("board-list")).toContainText("Delta Board");
  await expect(page.getByTestId("board-list")).not.toContainText("Gamma Board");
});

test("无匹配显示空提示", async ({ page }) => {
  await register(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Only Board" } });

  await page.goto(`/rooms/${room.id}/boards`);
  await page.getByTestId("search").fill("Nonexistent");
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("no-match")).toBeVisible();
});
