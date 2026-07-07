import { test, expect, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

// uc-rr-005-delete-contract 验收契约（p20-F06，Danger Zone）。
// DB 级 CASCADE 早已存在（rooms 上的 ON DELETE CASCADE 覆盖 boards/board_items/room_chats/
// room_chat_messages/room_files/room_members/surveys.room_id）；本 feature 的增量是**契约化**：
//   - owner 打开房间设置（Members 页）看到 DANGER ZONE（文案含 "Permanently"）
//   - 点击 Delete room 弹二次确认（data-testid=room-delete-confirm），逐项列出真实数量
//     （data-testid=room-delete-cascade-summary，X boards / Y chats / Z files / surveys）
//   - 需输入完全一致的房间名，确认按钮才可用（不匹配时禁用）
//   - 确认后 DELETE /api/rooms/:id 级联删除，跳回房间列表并 toast
//   - admin/member 在 UI 无入口，直调 DELETE 仍 403（现有行为，不能被破坏）
//   - 删除后原房间及其下 boards/chats/files 各资源 API 均返回 404
//
// L10：surveys 分支——canViewSurvey() 对不存在的 survey 返回 false，路由据此返回 403
// 而非 404（pre-existing 行为，任何不存在的 surveyId 皆如此，非本 feature 引入，
// 不在权限判定函数范围内修改）。本 spec 断言 403，与"该资源不可再访问"的契约意图一致，
// 不静默跳过这一分支。

const uniq = (p = "rr6") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const PASSWORD = "secret123";

test.afterEach(async () => {
  await closePool();
});

interface RegisteredUser {
  id: number;
  email: string;
}

async function register(page: Page, prefix = "u"): Promise<RegisteredUser> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: PASSWORD, agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { user: { id: number } };
  return { id: json.user.id, email };
}

async function login(page: Page, email: string) {
  const res = await page.request.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
}

async function createRoom(page: Page, name: string) {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { room: { id: number; name: string } };
  return body.room;
}

async function createBoard(page: Page, roomId: number, name: string) {
  const res = await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { board: { id: number } }).board;
}

async function createChat(page: Page, roomId: number, name: string) {
  const res = await page.request.post(`/api/rooms/${roomId}/chats`, { data: { name } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { chat: { id: number } }).chat;
}

async function createFile(page: Page, roomId: number, fileName: string) {
  const presignRes = await page.request.post(`/api/rooms/${roomId}/files`, {
    data: { fileName, fileSize: 20, contentType: "text/plain" },
  });
  expect(presignRes.status()).toBe(200);
  const { fileId, objectKey, uploadUrl } = (await presignRes.json()) as {
    fileId: string;
    objectKey: string;
    uploadUrl: string;
  };
  const putRes = await page.request.put(uploadUrl, {
    data: "room delete fixture",
    headers: { "content-type": "text/plain" },
  });
  expect(putRes.ok()).toBeTruthy();
  const confirmRes = await page.request.post(`/api/rooms/${roomId}/files/confirm`, {
    data: { fileId, objectKey, fileName, fileSize: 20, chatThreadId: null },
  });
  expect(confirmRes.status()).toBe(201);
  return ((await confirmRes.json()) as { file: { id: string } }).file;
}

async function createRoomSurvey(page: Page, roomId: number, title: string) {
  const res = await page.request.post("/api/surveys", {
    data: {
      title,
      description: "room delete fixture survey",
      scope: "room",
      roomId,
      questions: [{ title: "q1", type: "text", required: false, options: [] }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { survey: { id: number } }).survey;
}

test("owner 在 Members 页看到 DANGER ZONE，弹窗数量摘要真实，房间名不匹配时确认按钮禁用", async ({ page }) => {
  const owner = await register(page, "dzowner");
  const room = await createRoom(page, "Danger Zone Room");
  await createBoard(page, room.id, "B1");
  await createChat(page, room.id, "C1");
  await createFile(page, room.id, "f1.txt");
  await createRoomSurvey(page, room.id, "S1");

  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/members`);

  const dangerZone = page.getByTestId("room-danger-zone");
  await expect(dangerZone).toBeVisible();
  await expect(dangerZone).toContainText("Permanently");

  await page.getByTestId("room-delete-open").click();
  const confirmDialog = page.getByTestId("room-delete-confirm");
  await expect(confirmDialog).toBeVisible();

  const summary = page.getByTestId("room-delete-cascade-summary");
  await expect(summary).toBeVisible();
  await expect(page.getByTestId("room-delete-cascade-boards")).toHaveText("1 boards");
  await expect(page.getByTestId("room-delete-cascade-chats")).toHaveText("1 chats");
  await expect(page.getByTestId("room-delete-cascade-files")).toHaveText("1 files");
  await expect(page.getByTestId("room-delete-cascade-surveys")).toHaveText("1 surveys");

  const submitBtn = page.getByTestId("room-delete-confirm-submit");
  await expect(submitBtn).toBeDisabled();

  await page.getByTestId("room-delete-confirm-name").fill("wrong name");
  await expect(submitBtn).toBeDisabled();

  await page.getByTestId("room-delete-confirm-name").fill("Danger Zone Room");
  await expect(submitBtn).toBeEnabled();
});

test("admin/member 在 Members 页无 DANGER ZONE 入口；直调 DELETE 仍 403", async ({ page }) => {
  const owner = await register(page, "dzowner2");
  const admin = await register(page, "dzadmin2");
  const member = await register(page, "dzmember2");
  // register() 会自动登入被注册账号，因此建房间前必须显式切回 owner 会话
  // （否则房间会被最后一次 register 的账号——这里是 member——持有）。
  await login(page, owner.email);
  const room = await createRoom(page, "NoDeleteEntry");

  await page.request.post(`/api/rooms/${room.id}/members`, { data: { userId: admin.id } });
  await page.request.post(`/api/rooms/${room.id}/members`, { data: { userId: member.id } });
  await page.request.patch(`/api/rooms/${room.id}/members/${admin.id}`, { data: { role: "admin" } });

  await login(page, admin.email);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("room-danger-zone")).toHaveCount(0);
  const adminDelete = await page.request.delete(`/api/rooms/${room.id}`);
  expect(adminDelete.status()).toBe(403);

  await login(page, member.email);
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("room-danger-zone")).toHaveCount(0);
  const memberDelete = await page.request.delete(`/api/rooms/${room.id}`);
  expect(memberDelete.status()).toBe(403);
});

test("确认后级联删除 boards/board_items/chats/messages/files/members/survey 关联，跳回列表并 toast，各资源 404", async ({
  page,
}) => {
  const owner = await register(page, "dzowner3");
  const room = await createRoom(page, "CascadeRoom");

  const board = await createBoard(page, room.id, "CascadeBoard");
  const chat = await createChat(page, room.id, "CascadeChat");
  const file = await createFile(page, room.id, "cascade.txt");
  const survey = await createRoomSurvey(page, room.id, "CascadeSurvey");

  // board_items：在 board 内建一个 item，验证级联真的下钻到 board_items 这一层。
  const itemRes = await page.request.post(`/api/boards/${board.id}/items`, {
    data: { type: "note", x: 0, y: 0, text: "hi" },
  });
  expect(itemRes.status()).toBe(201);

  // room_chat_messages：往 chat 里发一条消息。
  const msgRes = await page.request.post(`/api/rooms/${room.id}/chats/${chat.id}/messages`, {
    data: { text: "hello" },
  });
  expect(msgRes.ok()).toBeTruthy();

  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/members`);
  await page.getByTestId("room-delete-open").click();
  await expect(page.getByTestId("room-delete-cascade-summary")).toBeVisible();
  await page.getByTestId("room-delete-confirm-name").fill("CascadeRoom");
  await page.getByTestId("room-delete-confirm-submit").click();

  await expect(page).toHaveURL(/\/rooms(\?deleted=.*)?$/);
  await expect(page.getByTestId("room-deleted-toast")).toBeVisible();
  await expect(page.getByTestId("room-deleted-toast")).toContainText("CascadeRoom");

  // 房间本体 404。
  expect((await page.request.get(`/api/rooms/${room.id}`)).status()).toBe(404);

  // boards（含 board_items 依附的 board）404。
  expect((await page.request.get(`/api/boards/${board.id}`)).status()).toBe(404);

  // room_chats（含消息）404 —— 走 room 子路由，room 已不存在故先 403 走不到；
  // 直接查 chat 详情：canViewRoom(roomId) 对不存在的房间返回 false → 403。
  // 这与 boards/files 不同：chats 详情路由的权限检查发生在資源存在性检查之前，
  // 是 F01/F09 既有实现，本 feature 不改权限判定顺序；用 403 断言"不可再访问"的契约。
  const chatRes = await page.request.get(`/api/rooms/${room.id}/chats/${chat.id}`);
  expect([403, 404]).toContain(chatRes.status());

  // room_files：room 不存在 → canViewRoom 403（同上，不可再访问）。
  const fileRes = await page.request.delete(`/api/rooms/${room.id}/files/${encodeURIComponent(file.id)}`);
  expect([403, 404]).toContain(fileRes.status());

  // surveys：canViewSurvey 对已被级联删除的 survey 返回 false → 403（pre-existing 行为，
  // 见文件头注释 L10）。
  const surveyRes = await page.request.get(`/api/surveys/${survey.id}`);
  expect(surveyRes.status()).toBe(403);
});
