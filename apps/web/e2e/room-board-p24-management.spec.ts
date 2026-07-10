// p24 Room Board 列表管理:多标签(新建/显示/过滤)+ 卡片三点菜单(删除)+ 封面上传。
// 契约锚定真实 boards 页(/rooms/[id]/boards)的 data-testid;后端多标签 schema(032)+ 封面直传。
import { test, expect, type Page } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

async function register(page: Page): Promise<void> {
  const email = `p24mgmt_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "M", lastName: "G", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
}

async function makeRoom(page: Page): Promise<string> {
  const r = await (await page.request.post("/api/rooms", { data: { name: "P24 室", visibility: "private" } })).json();
  return String(r.room.id);
}

test("新建白板带多标签 → 卡片显示 tag chips + 按 tag 过滤收窄列表", async ({ page }) => {
  await register(page);
  const roomId = await makeRoom(page);
  for (const b of [
    { name: "A 计划", tags: ["Planning", "Q3"] },
    { name: "B 复盘", tags: ["Retro"] },
    { name: "C 路线", tags: ["Planning"] },
  ]) {
    await page.request.post(`/api/rooms/${roomId}/boards`, { data: b });
  }

  await page.goto(`/rooms/${roomId}/boards`);
  await expect(page.getByTestId("board-list")).toBeVisible();
  // 卡片显示 tag chips
  await expect(page.locator('[data-testid^="board-card-tag-"]').first()).toBeVisible();
  // 过滤条含 Planning;点它后只剩含 Planning 的两块,B 复盘消失
  await page.getByTestId("board-tag-filter-Planning").click();
  await expect(page.getByTestId("board-filter-clear")).toBeVisible();
  await expect(page.getByText("A 计划")).toBeVisible();
  await expect(page.getByText("C 路线")).toBeVisible();
  await expect(page.getByText("B 复盘")).toHaveCount(0);
  // 清除恢复
  await page.getByTestId("board-filter-clear").click();
  await expect(page.getByText("B 复盘")).toBeVisible();
});

test("卡片三点菜单 → 删除(二次确认)从列表移除白板", async ({ page }) => {
  await register(page);
  const roomId = await makeRoom(page);
  const b = await (await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name: "待删板", tags: [] } })).json();
  const id = b.board.id;

  await page.goto(`/rooms/${roomId}/boards`);
  await expect(page.getByTestId(`board-${id}`)).toBeVisible();
  const menuBtn = page.getByTestId(`board-card-menu-${id}`);
  await menuBtn.hover();
  await menuBtn.click();
  await page.getByTestId(`board-menu-delete-${id}`).click();
  await expect(page.getByTestId("board-delete-dialog")).toBeVisible();
  await page.getByTestId("board-delete-confirm").click();
  await expect(page.getByTestId(`board-${id}`)).toHaveCount(0);
});

test("卡片菜单编辑标签 → 保存后卡片 tag chips 更新", async ({ page }) => {
  await register(page);
  const roomId = await makeRoom(page);
  const b = await (await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name: "改签板", tags: ["Old"] } })).json();
  const id = b.board.id;

  await page.goto(`/rooms/${roomId}/boards`);
  const menuBtn = page.getByTestId(`board-card-menu-${id}`);
  await menuBtn.hover();
  await menuBtn.click();
  await page.getByTestId(`board-menu-tags-${id}`).click();
  await expect(page.getByTestId("board-tags-dialog")).toBeVisible();
  await page.getByTestId("board-tags-input").fill("Fresh");
  await page.getByTestId("board-tags-input").press("Enter");
  await page.getByTestId("board-tags-save").click();
  await expect(page.getByTestId(`board-card-tag-${id}-Fresh`)).toBeVisible();
});

test("封面上传 → 卡片显示真实封面图;展示端点 302 到签名 URL", async ({ page }) => {
  await register(page);
  const roomId = await makeRoom(page);
  const b = await (await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name: "封面板", tags: [] } })).json();
  const id = b.board.id;

  const up = await page.request.post(`/api/boards/${id}/cover`, {
    multipart: { file: { name: "c.png", mimeType: "image/png", buffer: PNG } },
  });
  expect(up.status()).toBe(200);
  expect(String((await up.json()).board.cover)).toContain(`board-covers/${id}/`);

  const serve = await page.request.get(`/api/boards/${id}/cover`, { maxRedirects: 0 });
  expect([302, 307]).toContain(serve.status());

  await page.goto(`/rooms/${roomId}/boards`);
  await expect(page.getByTestId(`board-cover-img-${id}`)).toBeVisible();
});
