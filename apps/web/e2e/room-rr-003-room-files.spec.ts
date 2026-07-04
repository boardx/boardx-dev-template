import { test, expect, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

// uc-rr-003-room-level-files 验收契约（p20-F03，核心模型修正）。
// 推翻 uc-room-005「文件绑定聊天线程」的错误建模：room_files.room_id NOT NULL，
// chat_thread_id 可空仅作来源标注。覆盖：
//   - 房间级文件库跨线程可见（不打开任何聊天线程也能管理文件；同一文件出现在所有线程面板）
//   - 上传（预签名→直传→confirm）/ 搜索 / 按来源线程过滤 / 预览（签名 URL）
//   - 签名 URL 过期提示 + 点击刷新换取新签名 URL（契约缺口②，本 feature 自己的边界）
//   - 软删二次确认
//   - 删除权限矩阵：member 删他人文件 403；admin 删他人文件成功（契约缺口①，承接 F07）
//   - 不支持的文件类型 → 行内 "Unsupported file type"

const uniq = (p = "rr3") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
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

async function logout(page: Page) {
  const res = await page.request.post("/api/auth/logout");
  expect(res.ok()).toBeTruthy();
}

async function createRoom(page: Page, name = "RR3Room") {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { room: { id: number } };
  return body.room;
}

/** 走真实的预签名 → 直传 → confirm 三步上传一份房间文件（API 级，不经 UI）。 */
async function uploadRoomFileViaApi(
  page: Page,
  roomId: number,
  fileName: string,
  opts: { chatThreadId?: number; contentType?: string; body?: string } = {}
) {
  const presignRes = await page.request.post(`/api/rooms/${roomId}/files`, {
    data: {
      fileName,
      fileSize: (opts.body ?? "room file fixture").length,
      contentType: opts.contentType ?? "text/plain",
    },
  });
  expect(presignRes.status()).toBe(200);
  const { fileId, objectKey, uploadUrl } = (await presignRes.json()) as {
    fileId: string;
    objectKey: string;
    uploadUrl: string;
  };

  const putRes = await page.request.put(uploadUrl, {
    data: opts.body ?? "room file fixture",
    headers: { "content-type": opts.contentType ?? "text/plain" },
  });
  expect(putRes.ok()).toBeTruthy();

  const confirmRes = await page.request.post(`/api/rooms/${roomId}/files/confirm`, {
    data: {
      fileId,
      objectKey,
      fileName,
      fileSize: (opts.body ?? "room file fixture").length,
      chatThreadId: opts.chatThreadId ?? null,
    },
  });
  expect(confirmRes.status()).toBe(201);
  const body = (await confirmRes.json()) as { file: { id: string } };
  return body.file;
}

test("房间级文件库跨线程可见：不打开任何聊天线程也能管理文件，且同一文件出现在所有线程面板", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);

  // 前置：两个聊天线程。
  const chatA = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "ChatA" } })).json())
    .chat;
  const chatB = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "ChatB" } })).json())
    .chat;

  // 不打开任何聊天线程，直接在 Files tab 上传（uc-rr-003 前置条件修正）。
  const file = await uploadRoomFileViaApi(page, room.id, "cross-thread.txt");

  // Files tab 可见（无需先进任何聊天）。
  const listAll = await page.request.get(`/api/rooms/${room.id}/files`);
  expect(listAll.status()).toBe(200);
  const allBody = (await listAll.json()) as { files: { id: string; chat_thread_id: number | null }[] };
  expect(allBody.files.map((f) => f.id)).toContain(file.id);

  // 在 chatA 面板上传一份文件（带来源标注）。
  const fileFromChatA = await uploadRoomFileViaApi(page, room.id, "from-chat-a.txt", { chatThreadId: chatA.id });

  // 该文件同时出现在 chatA 和 chatB 的"全部来源"视图里（不按 chat_thread_id 过滤即为全量）。
  const listForPanel = await page.request.get(`/api/rooms/${room.id}/files`);
  const panelBody = (await listForPanel.json()) as { files: { id: string }[] };
  expect(panelBody.files.map((f) => f.id)).toEqual(
    expect.arrayContaining([file.id, fileFromChatA.id])
  );

  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/files`);
  await expect(page.getByTestId("room-files-tab")).toBeVisible();
  await expect(page.getByTestId("room-files-item").filter({ hasText: "cross-thread.txt" })).toBeVisible();
  await expect(page.getByTestId("room-files-item").filter({ hasText: "from-chat-a.txt" })).toBeVisible();

  // 两个聊天线程的左侧面板都能看到同一批房间文件。
  await page.goto(`/rooms/${room.id}/chats/${chatA.id}`);
  await expect(page.getByTestId("room-files-panel")).toBeVisible();
  await expect(page.getByTestId("room-files-panel-list")).toContainText("cross-thread.txt");
  await expect(page.getByTestId("room-files-panel-list")).toContainText("from-chat-a.txt");

  await page.goto(`/rooms/${room.id}/chats/${chatB.id}`);
  await expect(page.getByTestId("room-files-panel-list")).toContainText("cross-thread.txt");
  await expect(page.getByTestId("room-files-panel-list")).toContainText("from-chat-a.txt");
});

test("上传（拖拽区/预签名直传）UI 全链路：文件出现在列表；上传后可通过搜索 + 来源过滤定位", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  await login(page, owner.email);

  await page.goto(`/rooms/${room.id}/files`);
  await expect(page.getByTestId("room-files-tab")).toBeVisible();
  await expect(page.getByTestId("empty")).toBeVisible();

  const uploadRes = page.waitForResponse(
    (res) => res.url().includes(`/api/rooms/${room.id}/files/confirm`) && res.request().method() === "POST"
  );
  await page.getByTestId("room-files-file-input").setInputFiles({
    name: "ui-upload.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("ui upload fixture"),
  });
  const confirmResponse = await uploadRes;
  expect(confirmResponse.status()).toBe(201);

  await expect(page.getByTestId("room-files-list")).toContainText("ui-upload.pdf");
  await expect(page.getByTestId("empty")).toHaveCount(0);

  // 搜索定位。
  await page.getByTestId("room-files-search").fill("ui-upload");
  await page.getByTestId("room-files-search").press("Enter");
  await expect(page.getByTestId("room-files-list")).toContainText("ui-upload.pdf");

  await page.getByTestId("room-files-search").fill("no-such-file");
  await page.getByTestId("room-files-search").press("Enter");
  await expect(page.getByTestId("room-files-list")).toHaveCount(0);
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("按来源线程过滤：只勾选某线程时只看到该线程标注的文件", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  const chatA = (await (await page.request.post(`/api/rooms/${room.id}/chats`, { data: { name: "ChatA" } })).json())
    .chat;

  await uploadRoomFileViaApi(page, room.id, "no-thread.txt");
  await uploadRoomFileViaApi(page, room.id, "thread-a.txt", { chatThreadId: chatA.id });

  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/files`);
  await expect(page.getByTestId("room-files-list")).toContainText("no-thread.txt");
  await expect(page.getByTestId("room-files-list")).toContainText("thread-a.txt");

  await page.getByTestId("room-files-thread-filter").selectOption(String(chatA.id));
  await expect(page.getByTestId("room-files-list")).toContainText("thread-a.txt");
  await expect(page.getByTestId("room-files-list")).not.toContainText("no-thread.txt");

  await page.getByTestId("room-files-thread-filter").selectOption("");
  await expect(page.getByTestId("room-files-list")).toContainText("no-thread.txt");
});

test("预览：签发签名 URL 且真实可用（API 级，证明预签名机制本身是真实的，非 mock）", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  const file = await uploadRoomFileViaApi(page, room.id, "preview-me.txt");
  await login(page, owner.email);

  const res = await page.request.get(`/api/rooms/${room.id}/files/${file.id}/preview`);
  expect(res.status()).toBe(200);
  const { previewUrl } = (await res.json()) as { previewUrl: string };
  expect(previewUrl).toContain("X-Amz-Signature");
  const fetched = await page.request.get(previewUrl);
  expect(fetched.ok()).toBeTruthy();
});

test("预览：签名 URL 过期后真实拒绝访问（API 级，1 秒过期窗口，证明过期机制真实生效）", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  const file = await uploadRoomFileViaApi(page, room.id, "expiring.txt");
  await login(page, owner.email);

  const res = await page.request.get(`/api/rooms/${room.id}/files/${file.id}/preview?expiresInSeconds=1`);
  expect(res.status()).toBe(200);
  const { previewUrl } = (await res.json()) as { previewUrl: string };

  await page.waitForTimeout(1500);
  const expiredFetch = await page.request.get(previewUrl);
  expect(expiredFetch.ok()).toBeFalsy();
});

test("UI：预览过期后展示过期提示文案，点击刷新换取新签名 URL 后可正常预览（契约缺口②，本 feature 自己的边界）", async ({
  page,
}) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  const file = await uploadRoomFileViaApi(page, room.id, "preview-refresh.txt");
  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/files`);

  // 正常预览：签发签名 URL 且展示为可用链接。
  await page.getByTestId(`room-files-preview-${file.id}`).click();
  await expect(page.getByTestId("room-files-preview-modal")).toBeVisible();
  await expect(page.getByTestId("room-files-preview-link")).toBeVisible();
  await expect(page.getByTestId("room-files-preview-link")).toContainText("X-Amz-Signature");
  await page.getByRole("button", { name: "关闭预览" }).click();
  await expect(page.getByTestId("room-files-preview-modal")).toHaveCount(0);

  // 拦截该文件的对象存储直链请求，模拟"签名 URL 已过期"这一真实会发生的网络结果——
  // preview 接口本身正常返回 URL（与生产行为一致），只是这个 URL 此刻不可用。
  // Shift+click 触发短过期请求路径（生产路径的一部分：openPreview 支持 forceExpiresInSeconds），
  // 配合路由拦截让"该 URL 校验失败"这一步确定性可复现，断言的是前端对失败结果的处理路径。
  let objectRequestCount = 0;
  await page.route("**/boardx-kb/rooms/**", async (route) => {
    objectRequestCount += 1;
    await route.fulfill({ status: 403, body: "AccessDenied: request has expired" });
  });

  await page.getByTestId(`room-files-preview-${file.id}`).click({ modifiers: ["Shift"] });
  await expect(page.getByTestId("room-files-preview-expired")).toBeVisible();
  expect(objectRequestCount).toBeGreaterThan(0);

  // 移除拦截，点击刷新换取新签名 URL 后应恢复正常预览。
  await page.unroute("**/boardx-kb/rooms/**");
  const refreshRes = page.waitForResponse(
    (res) => res.url().includes(`/files/${file.id}/preview`) && res.request().method() === "GET"
  );
  await page.getByTestId("room-files-preview-refresh").click();
  await refreshRes;
  await expect(page.getByTestId("room-files-preview-link")).toBeVisible();
  await expect(page.getByTestId("room-files-preview-expired")).toHaveCount(0);
});

test("软删二次确认：取消保留文件行，确认后立即从列表移除", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  const file = await uploadRoomFileViaApi(page, room.id, "to-delete.txt");
  const keep = await uploadRoomFileViaApi(page, room.id, "keep-me.txt");

  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/files`);
  await expect(page.getByTestId("room-files-list")).toContainText("to-delete.txt");

  // 取消：文件行保留。
  await page.getByTestId(`room-files-delete-${file.id}`).click();
  await expect(page.getByTestId(`room-files-confirm-delete-${file.id}`)).toBeVisible();
  await page.getByTestId(`room-files-confirm-delete-no-${file.id}`).click();
  await expect(page.getByTestId(`room-files-confirm-delete-${file.id}`)).toHaveCount(0);
  await expect(page.getByTestId("room-files-list")).toContainText("to-delete.txt");

  // 确认：立即从列表移除，另一个文件仍在。
  await page.getByTestId(`room-files-delete-${file.id}`).click();
  const deleteRes = page.waitForResponse(
    (res) => res.url().includes(`/api/rooms/${room.id}/files/${file.id}`) && res.request().method() === "DELETE"
  );
  await page.getByTestId(`room-files-confirm-delete-yes-${file.id}`).click();
  const deleteResponse = await deleteRes;
  expect(deleteResponse.status()).toBe(200);

  await expect(page.getByTestId("room-files-list")).not.toContainText("to-delete.txt");
  await expect(page.getByTestId("room-files-list")).toContainText("keep-me.txt");

  // 软删后其他视角（如另一次 GET）不再返回该文件（E3：其他线程面板刷新后不再展示）。
  const listAfter = await page.request.get(`/api/rooms/${room.id}/files`);
  const listBody = (await listAfter.json()) as { files: { id: string }[] };
  expect(listBody.files.map((f) => f.id)).not.toContain(file.id);
  expect(listBody.files.map((f) => f.id)).toContain(keep.id);
});

test("删除权限矩阵：member 删他人文件 403；上传者本人删自己文件成功；admin 删他人文件成功（契约缺口①，承接 F07）", async ({
  page,
}) => {
  // 注意：register() 内部会话即登录（注册即登录，与 kb-* spec 同一模式），同一 page 的
  // cookie jar 会被后一次 register 覆盖——所以每次切换"当前身份"都必须显式 login()，
  // 不能依赖 register() 调用顺序残留的会话。
  const owner = await register(page, "owner");
  const admin = await register(page, "admin");
  const member = await register(page, "member");

  await login(page, owner.email);
  const room = await createRoom(page);

  await page.request.post(`/api/rooms/${room.id}/members`, { data: { userId: admin.id } });
  await page.request.post(`/api/rooms/${room.id}/members`, { data: { userId: member.id } });
  await page.request.patch(`/api/rooms/${room.id}/members/${admin.id}`, { data: { role: "admin" } });

  // owner 上传一个文件（当前身份仍是 owner）。
  const ownerFile = await uploadRoomFileViaApi(page, room.id, "owner-file.txt");

  // 切到 member：删除他人（owner 上传的）文件 → 403。
  await logout(page);
  await login(page, member.email);
  const memberDeleteOthers = await page.request.delete(`/api/rooms/${room.id}/files/${ownerFile.id}`);
  expect(memberDeleteOthers.status()).toBe(403);

  // member 上传自己的文件，删除自己的文件 → 成功（上传者本人）。
  const memberFile = await uploadRoomFileViaApi(page, room.id, "member-file.txt");
  const memberDeleteOwn = await page.request.delete(`/api/rooms/${room.id}/files/${memberFile.id}`);
  expect(memberDeleteOwn.status()).toBe(200);

  // 切到 admin：删除 owner 上传的他人文件 → 成功（契约缺口①：admin 可删他人文件）。
  await logout(page);
  await login(page, admin.email);
  const adminDeleteOthers = await page.request.delete(`/api/rooms/${room.id}/files/${ownerFile.id}`);
  expect(adminDeleteOthers.status()).toBe(200);

  // 正向核验：ownerFile 真的被删了（不再出现在列表）。
  const list = await page.request.get(`/api/rooms/${room.id}/files`);
  const listBody = (await list.json()) as { files: { id: string }[] };
  expect(listBody.files.map((f) => f.id)).not.toContain(ownerFile.id);
});

test("不支持的文件类型上传 → 行内提示 Unsupported file type，且不落库", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  await login(page, owner.email);

  await page.goto(`/rooms/${room.id}/files`);
  await page.getByTestId("room-files-file-input").setInputFiles({
    name: "virus.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("nope"),
  });

  await expect(page.getByTestId("room-files-queue-item-error")).toContainText("Unsupported file type");
  await expect(page.getByTestId("empty")).toBeVisible();

  // 服务端二次校验：直接 POST 请求预签名也拒绝，不签发直传 URL。
  const res = await page.request.post(`/api/rooms/${room.id}/files`, {
    data: { fileName: "virus.exe", fileSize: 4, contentType: "application/octet-stream" },
  });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as { errors?: Record<string, string> };
  expect(body.errors?.type).toContain("Unsupported file type");
});

test("未登录访问 Files tab / API → 房间壳展示未登录提示，API 返回 401", async ({ page }) => {
  const owner = await register(page, "owner");
  const room = await createRoom(page);
  await logout(page);

  // 房间壳（layout.tsx）统一处理未登录态：/api/rooms/:id 401 → 展示"请先登录"提示，
  // 不做客户端重定向（与 room-rr-001-detail-shell、boards/chats 子页的既有行为一致——
  // Files tab 自身对 401 也必须只静默返回，不能 router.replace，否则会把整棵路由树
  // 连带父级 layout 的错误横幅一起卸载掉）。
  await page.goto(`/rooms/${room.id}/files`);
  await expect(page.getByTestId("room-shell-error")).toContainText("请先登录");

  const res = await page.request.get(`/api/rooms/${room.id}/files`);
  expect(res.status()).toBe(401);
});
