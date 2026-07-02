import { expect, test } from "@playwright/test";

const uniq = () => `local001_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Local Workspace" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Local Board" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("编辑者使用 Local Workspace：Board Chat 结果可保存为 Board Memory", async ({ page }) => {
  await openOwnBoard(page);

  await page.getByTestId("local-workspace-open").click();
  await expect(page.getByTestId("local-workspace-panel")).toBeVisible();
  await expect(page.getByTestId("local-chat-panel")).toBeVisible();
  await expect(page.getByTestId("local-chat-status")).toContainText("仅显示在当前会话");

  await page.getByTestId("local-chat-input").fill("总结这块白板");
  await page.getByTestId("local-chat-send").click();
  await expect(page.getByTestId("local-chat-user")).toContainText("总结这块白板");
  await expect(page.getByTestId("local-chat-assistant")).toContainText("Board Chat 已在当前白板上下文中记录");
  await expect(page.getByTestId("local-chat-status")).toContainText("尚未保存为 Board Memory");

  await page.getByTestId("local-workspace-close").click();
  await page.getByTestId("local-workspace-open").click();
  await expect(page.getByTestId("local-chat-assistant")).toContainText("总结这块白板");

  await page.getByTestId("local-chat-save-memory").click();
  await expect(page.getByTestId("local-chat-status")).toContainText("已保存为 Board Memory");

  await page.getByTestId("local-workspace-memory-tab").click();
  await expect(page.getByTestId("local-memory-count")).toHaveText("1 条");
  await expect(page.getByTestId("local-memory-item")).toContainText("总结这块白板");

  await page.getByTestId("local-memory-input").fill("风险点：需要确认分享范围");
  await page.getByTestId("local-memory-add").click();
  await expect(page.getByTestId("local-memory-count")).toHaveText("2 条");
  await expect(page.getByTestId("local-memory-status")).toContainText("已保存为 Board Memory");

  await page.getByTestId("local-memory-search").fill("风险点");
  await expect(page.getByTestId("local-memory-item")).toHaveCount(1);
  await expect(page.getByTestId("local-memory-item")).toContainText("风险点");
  await page.getByTestId("local-memory-delete").click();
  await expect(page.getByTestId("local-memory-empty")).toBeVisible();

  await page.reload();
  await page.getByTestId("local-workspace-open").click();
  await expect(page.getByTestId("local-chat-empty")).toBeVisible();
  await page.getByTestId("local-workspace-memory-tab").click();
  await expect(page.getByTestId("local-memory-count")).toHaveText("1 条");
  await expect(page.getByTestId("local-memory-item")).toContainText("总结这块白板");
});

test("viewer 不显示 Local Workspace 编辑入口", async ({ page, playwright }) => {
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Public Room" } })).json()).room;
  const board = (await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Viewer Board" } })).json()).board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);

  await expect(page.getByTestId("board-role")).toHaveText("viewer");
  await expect(page.getByTestId("local-workspace-open")).toHaveCount(0);
  await expect(page.getByTestId("local-workspace-panel")).toHaveCount(0);

  await owner.dispose();
});
