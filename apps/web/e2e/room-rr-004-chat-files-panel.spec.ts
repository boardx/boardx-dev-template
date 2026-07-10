import { test, expect, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

// p20/F04 聊天工作区左栏接通房间文件库（sources 勾选）——uc-rr-003 步骤 4/6。
// 契约 data-testid：room-files-panel、room-files-source-toggle。
// 覆盖 user_visible_behavior：
//   - 聊天三栏工作区左栏展示与 Files tab 同一房间文件列表（room-files-panel）
//   - 可在此上传（落房间库并标注 chat_thread_id 来源）
//   - 可勾选文件作为 AI 上下文 sources（room-files-source-toggle），
//     展示『N sources selected as context』
//   - 同一文件在该房间所有线程可见（跨线程可见）

const uniq = (p = "rr4") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const PASSWORD = "secret123";

test.afterEach(async () => {
  await closePool();
});

async function register(page: Page, prefix = "u"): Promise<{ id: number; email: string }> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: PASSWORD, agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { user: { id: number } };
  return { id: json.user.id, email };
}

async function createRoom(page: Page, name = "RR4Room"): Promise<number> {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { room: { id: number } };
  return body.room.id;
}

async function createChat(page: Page, roomId: number, name: string): Promise<number> {
  const res = await page.request.post(`/api/rooms/${roomId}/chats`, { data: { name } });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { chat: { id: number } };
  return body.chat.id;
}

test("聊天左栏：上传文件到房间库（标注线程来源）→ 勾选为 sources → 显示 N sources selected as context", async ({
  page,
}) => {
  await register(page, "owner");
  const roomId = await createRoom(page);
  const chatId = await createChat(page, roomId, "Thread A");

  await page.goto(`/rooms/${roomId}/chats/${chatId}`);
  await expect(page.getByTestId("room-files-panel")).toBeVisible();
  // 起始空态。
  await expect(page.getByTestId("room-files-panel").getByTestId("empty")).toBeVisible();

  // 在左栏面板直接上传：预签名→直传→confirm 全链路（confirm 会带 chatThreadId 标注来源）。
  const confirmRes = page.waitForResponse(
    (res) => res.url().includes(`/api/rooms/${roomId}/files/confirm`) && res.request().method() === "POST"
  );
  await page.getByTestId("room-files-panel-file-input").setInputFiles({
    name: "chat-panel-upload.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("chat panel upload fixture"),
  });
  const confirmResponse = await confirmRes;
  expect(confirmResponse.status()).toBe(201);
  // 落库时确带上当前线程作来源标注（component 以字符串 prop 收 chatId，postData 里可能是
  // number 或 string 形态，两者都接受——服务端 confirm 也对两种形态归一化）。
  expect(Number(confirmResponse.request().postDataJSON().chatThreadId)).toBe(Number(chatId));

  // 文件出现在左栏列表。
  await expect(page.getByTestId("room-files-panel-list")).toContainText("chat-panel-upload.txt");

  // 勾选 source-toggle → 出现『N sources selected as context』。
  const toggle = page.getByTestId("room-files-source-toggle").first();
  await expect(toggle).toBeVisible();
  await toggle.check();
  await expect(page.getByTestId("room-files-panel-selected-count")).toHaveText("1 sources selected as context");

  // 取消勾选 → 计数区消失。
  await toggle.uncheck();
  await expect(page.getByTestId("room-files-panel-selected-count")).toHaveCount(0);
});

test("同一房间文件在所有聊天线程左栏可见（跨线程可见）", async ({ page }) => {
  await register(page, "owner");
  const roomId = await createRoom(page);
  const chatA = await createChat(page, roomId, "Thread A");
  const chatB = await createChat(page, roomId, "Thread B");

  // 在 Thread A 左栏上传一份文件。
  await page.goto(`/rooms/${roomId}/chats/${chatA}`);
  await expect(page.getByTestId("room-files-panel")).toBeVisible();
  const confirmRes = page.waitForResponse(
    (res) => res.url().includes(`/api/rooms/${roomId}/files/confirm`) && res.request().method() === "POST"
  );
  await page.getByTestId("room-files-panel-file-input").setInputFiles({
    name: "shared-across-threads.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("shared fixture"),
  });
  expect((await confirmRes).status()).toBe(201);
  await expect(page.getByTestId("room-files-panel-list")).toContainText("shared-across-threads.txt");

  // 切到另一个线程 B，同一文件仍在左栏可见（房间级、非线程绑定）。
  await page.goto(`/rooms/${roomId}/chats/${chatB}`);
  await expect(page.getByTestId("room-files-panel")).toBeVisible();
  await expect(page.getByTestId("room-files-panel-list")).toContainText("shared-across-threads.txt");

  // 在 B 线程也能勾选该文件为 source。
  const toggle = page.getByTestId("room-files-source-toggle").first();
  await toggle.check();
  await expect(page.getByTestId("room-files-panel-selected-count")).toHaveText("1 sources selected as context");
});
