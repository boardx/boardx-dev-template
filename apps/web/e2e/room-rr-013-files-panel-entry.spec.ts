// p22/F02 Room Files 双入口职责边界（uc 见 requirements/00-overview.md 优先级1）
// 契约：聊天工作区左栏 Room Files 面板头部有"查看全部"链接跳转 Files tab；
// 空态文案里的"前往 Files tab"是真正可点击链接。
import { test, expect, type Page } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page, prefix: string): Promise<string> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return email;
}

async function createRoom(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  const d = await res.json();
  return d.room.id as number;
}

async function createChat(page: Page, roomId: number, name: string): Promise<number> {
  const res = await page.request.post(`/api/rooms/${roomId}/chats`, { data: { name } });
  const d = await res.json();
  return d.chat.id as number;
}

test("Room Files 面板头部有查看全部链接，跳转到该房间 Files tab", async ({ page }) => {
  await register(page, "filesentry1");
  const roomId = await createRoom(page, "Files Entry Room");
  const chatId = await createChat(page, roomId, "Thread A");

  await page.goto(`/rooms/${roomId}/chats/${chatId}`);
  await expect(page.getByTestId("room-files-panel")).toBeVisible();
  await page.getByTestId("room-files-panel-open-files-tab").click();
  // 系统偶发资源紧张下客户端路由切换会变慢（已核实非功能性 bug——elementFromPoint/href
  // 均命中正确元素，纯粹是导航耗时变长），放宽等待窗口。
  await page.waitForURL(new RegExp(`/rooms/${roomId}/files$`), { timeout: 20000 });
  await expect(page.getByTestId("room-tab-files")).toHaveAttribute("data-active", "true");
});

test("空文件列表时，提示文案里的前往 Files tab 是可点击链接", async ({ page }) => {
  await register(page, "filesentry2");
  const roomId = await createRoom(page, "Empty Files Room");
  const chatId = await createChat(page, roomId, "Thread B");

  await page.goto(`/rooms/${roomId}/chats/${chatId}`);
  const empty = page.getByTestId("room-files-panel").getByTestId("empty");
  await expect(empty).toContainText("前往 Files tab");
  await empty.getByRole("link", { name: "前往 Files tab" }).click();
  await page.waitForURL(new RegExp(`/rooms/${roomId}/files$`), { timeout: 20000 });
});
