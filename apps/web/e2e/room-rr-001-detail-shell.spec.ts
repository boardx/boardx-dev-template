// p20/F01 房间详情壳与 Tab 导航（uc-rr-001）
// 契约：/rooms/[id] 默认落 Boards tab；页头面包屑/房间名/可见性 pill/成员头像/Invite（仅 owner/admin）；
// 五 tab 常驻、URL 同步、直链高亮；非成员 403 态。
import { test, expect, type Page } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

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

test("进入 /rooms/[id] 默认落 Boards tab，壳完整（面包屑/房间名/pill/头像/五 tab）", async ({ page }) => {
  await register(page, "shellowner");
  const roomId = await createRoom(page, "Shell Room");

  await page.goto(`/rooms/${roomId}`);
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/boards$`));

  const shell = page.getByTestId("room-shell");
  await expect(shell).toBeVisible();
  await expect(page.getByTestId("room-breadcrumb")).toContainText("Rooms");
  await expect(page.getByTestId("room-header-name")).toHaveText("Shell Room");
  await expect(page.getByTestId("room-visibility-pill")).toContainText("Private");
  await expect(page.getByTestId("room-members-avatars")).toBeVisible();
  // owner 可见 Invite
  await expect(page.getByTestId("room-invite-btn")).toBeVisible();

  for (const t of ["boards", "members", "files", "chat", "survey"]) {
    await expect(page.getByTestId(`room-tab-${t}`)).toBeVisible();
  }
  await expect(page.getByTestId("room-tab-boards")).toHaveAttribute("data-active", "true");
});

test("tab 切换 URL 同步；直链打开对应 tab 高亮；Files/Survey 有占位内容", async ({ page }) => {
  await register(page, "shelltabs");
  const roomId = await createRoom(page, "Tabs Room");

  await page.goto(`/rooms/${roomId}/boards`);
  await page.getByTestId("room-tab-members").click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/members$`));
  await expect(page.getByTestId("room-tab-members")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("room-tab-boards")).toHaveAttribute("data-active", "false");

  // 直链 → 高亮正确
  await page.goto(`/rooms/${roomId}/chats`);
  await expect(page.getByTestId("room-tab-chat")).toHaveAttribute("data-active", "true");

  // Files / Survey 占位（F03/F08 填充真实内容）
  await page.goto(`/rooms/${roomId}/files`);
  await expect(page.getByTestId("room-tab-files")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("room-files-placeholder")).toBeVisible();
  await page.goto(`/rooms/${roomId}/surveys`);
  await expect(page.getByTestId("room-tab-survey")).toHaveAttribute("data-active", "true");
  await expect(page.getByTestId("room-survey-placeholder")).toBeVisible();
});

test("member 角色看不到 Invite 按钮；owner 看得到", async ({ page, playwright }) => {
  // owner 建房并邀请 member
  const ownerCtx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ownerCtx.post("/api/auth/register", {
    data: { firstName: "O", lastName: "Owner", email: uniq("shellown2"), password: "secret123", agreeTerms: true },
  });
  const room = (await (await ownerCtx.post("/api/rooms", { data: { name: "Invite Room" } })).json()).room;

  // page 上下文注册 member 用户，owner 按 email 拉进房
  const memberEmail = await register(page, "shellmember");
  const add = await ownerCtx.post(`/api/rooms/${room.id}/members`, { data: { email: memberEmail } });
  expect(add.ok()).toBe(true);

  await page.goto(`/rooms/${room.id}/boards`);
  await expect(page.getByTestId("room-shell")).toBeVisible();
  await expect(page.getByTestId("room-header-name")).toHaveText("Invite Room");
  await expect(page.getByTestId("room-invite-btn")).toHaveCount(0);

  await ownerCtx.dispose();
});

test("非成员访问显示 403 态并可返回房间列表", async ({ page, playwright }) => {
  const ownerCtx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ownerCtx.post("/api/auth/register", {
    data: { firstName: "O", lastName: "Sec", email: uniq("shellsec"), password: "secret123", agreeTerms: true },
  });
  const room = (await (await ownerCtx.post("/api/rooms", { data: { name: "Secret Shell", visibility: "private" } })).json()).room;

  await register(page, "shelloutsider");
  await page.goto(`/rooms/${room.id}/boards`);
  await expect(page.getByTestId("room-shell-error")).toBeVisible();
  await expect(page.getByTestId("room-shell-error")).toContainText("成员");
  await page.getByTestId("room-back-to-list").click();
  await expect(page).toHaveURL(/\/rooms$/);

  await ownerCtx.dispose();
});
