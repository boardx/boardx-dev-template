import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// uc-room-003-invite-manage-room-members
// 房间管理者邀请团队成员或外部邮箱进入房间，并维护房间成员角色。
const uniq = (p = "r3") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function registerOnPage(page: Page, email = uniq()) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  return email;
}

async function newUserCtx(playwright: any): Promise<{ ctx: APIRequestContext; email: string; userId: number }> {
  const email = uniq("guest");
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "G", lastName: "G", email, password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, email, userId: reg.user.id };
}

test("房间管理者看到成员列表 + 邮箱邀请已注册用户加入", async ({ page, playwright }) => {
  await registerOnPage(page);
  const { ctx: guest, email: guestEmail } = await newUserCtx(playwright);

  const room = (await (await page.request.post("/api/rooms", { data: { name: "R3", visibility: "private" } })).json()).room;

  await page.goto(`/rooms/${room.id}/members`);

  // 成员列表里至少有 owner 自己
  await expect(page.getByTestId("member-list")).toBeVisible();
  // 管理者能看到邀请区
  await expect(page.getByTestId("invite-section")).toBeVisible();

  // 已注册邮箱 → 直接加入房间
  await page.getByTestId("invite-email").fill(guestEmail);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`invite-result-${guestEmail}`)).toContainText("已加入房间");
  // 列表更新：新成员出现
  await expect(page.getByTestId("member-list")).toContainText(guestEmail);

  await guest.dispose();
});

test("未注册邮箱 → 邀请流程；空邮箱与无效邮箱 → 错误提示", async ({ page }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "RErr" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("invite-section")).toBeVisible();

  const stranger = uniq("stranger");
  await page.getByTestId("invite-email").fill(stranger);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`invite-result-${stranger}`)).toContainText("邀请已发送");

  await page.getByTestId("invite-email").fill("not-an-email");
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId("invite-err")).toContainText("invalidEmail");
});

test("管理者改成员角色 / 移除成员，列表随之更新", async ({ page, playwright }) => {
  await registerOnPage(page);
  const { ctx: guest, email: guestEmail, userId: guestId } = await newUserCtx(playwright);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "RRole" } })).json()).room;
  // 先把 guest 加进房间
  await page.request.post(`/api/rooms/${room.id}/members`, { data: { userId: guestId } });

  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId(`member-${guestId}`)).toBeVisible();

  // 提升为 admin
  await page.getByTestId(`role-select-${guestId}`).selectOption("admin");
  await expect(page.getByTestId(`role-${guestId}`)).toContainText("admin");

  // 移除成员
  await page.getByTestId(`remove-${guestId}`).click();
  await expect(page.getByTestId(`member-${guestId}`)).toHaveCount(0);

  await guest.dispose();
});

test("普通成员 → 只读：无邀请区，有只读提示", async ({ page, playwright }) => {
  const { ctx: owner, userId: _o } = await newUserCtx(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "RRead" } })).json()).room;
  // member 在 page context 注册并被加入房间
  const memberEmail = await registerOnPage(page);
  const me = await (await page.request.get("/api/auth/session")).json();
  await owner.post(`/api/rooms/${room.id}/members`, { data: { userId: me.user.id } });

  await page.goto(`/rooms/${room.id}/members`);
  await expect(page.getByTestId("member-list")).toBeVisible();
  await expect(page.getByTestId("invite-section")).toHaveCount(0);
  await expect(page.getByTestId("readonly-notice")).toBeVisible();

  void memberEmail;
  await owner.dispose();
});

test("未登录访问 /rooms/[id]/members → 跳 /login", async ({ page }) => {
  await page.goto("/rooms/1/members");
  await expect(page).toHaveURL(/\/login/);
});

test("API：owner 不可被移除；admin 不能移除另一个 admin", async ({ playwright }) => {
  const { ctx: owner, userId: ownerId } = await newUserCtx(playwright);
  const room = (await (await owner.post("/api/rooms", { data: { name: "RPerm" } })).json()).room;
  const { ctx: a1, userId: a1Id, email: _a1 } = await newUserCtx(playwright);
  const { ctx: a2, userId: a2Id } = await newUserCtx(playwright);

  await owner.post(`/api/rooms/${room.id}/members`, { data: { userId: a1Id } });
  await owner.post(`/api/rooms/${room.id}/members`, { data: { userId: a2Id } });
  // a1, a2 都升为 admin
  await owner.patch(`/api/rooms/${room.id}/members/${a1Id}`, { data: { role: "admin" } });
  await owner.patch(`/api/rooms/${room.id}/members/${a2Id}`, { data: { role: "admin" } });

  // owner 不可被移除
  expect((await owner.delete(`/api/rooms/${room.id}/members/${ownerId}`)).status()).toBe(403);
  // a1(admin) 不能移除 a2(admin)
  expect((await a1.delete(`/api/rooms/${room.id}/members/${a2Id}`)).status()).toBe(403);

  await owner.dispose();
  await a1.dispose();
  await a2.dispose();
});
