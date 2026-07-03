import { test, expect, type APIRequestContext, type Page } from "@playwright/test";

// uc-rr-008 / p20 F09：邀请未注册用户加入房间（完整流）。
// 覆盖：未注册邮箱邀请落库 + pending 列表可见、重复邀请幂等（不重复行）、撤销、
// member 邀请 403、注册后自动入房、过期令牌不入房但注册成功。
const uniq = (p = "f09") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerOnPage(page: Page, email = uniq()) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
  return email;
}

async function newUserCtx(playwright: any, baseURL: string): Promise<{ ctx: APIRequestContext; email: string; userId: number }> {
  const email = uniq("owner");
  const ctx = await playwright.request.newContext({ baseURL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "G", lastName: "G", email, password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, email, userId: reg.user.id };
}

test("owner 邀请未注册邮箱：落库 + pending 列表可见，响应体不泄漏 token", async ({ page }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-A" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("invitee");
  await page.getByTestId("invite-email").fill(invitee);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/rooms/${room.id}/members`) && r.request().method() === "POST"),
    page.getByTestId("invite-submit").click(),
  ]);
  const body = await res.json();
  expect(body.status).toBe("invited");
  expect(body.token).toBeUndefined(); // 安全契约：响应体绝不含 token

  await expect(page.getByTestId(`invite-result-${invitee}`)).toContainText("邀请已发送");

  // pending 列表可见
  await expect(page.getByTestId("room-invite-pending")).toBeVisible();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toContainText(invitee);

  // dev 邮件通道确实"发出"了邀请邮件（落库 + 含注册链接）
  const outbox = await (
    await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(invitee)}&kind=room_invite`)
  ).json();
  expect(outbox.mail?.body ?? "").toContain("/register");
});

test("重复邀请同一邮箱：幂等刷新 token/过期时间，不产生重复行", async ({ page }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-B" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("dup");
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("invite-email").fill(invitee);
    await page.getByTestId("invite-submit").click();
    await expect(page.getByTestId(`invite-result-${invitee}`)).toContainText("邀请已发送");
  }

  // 只有一条 pending 记录（data-testid 唯一，count=1）
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toHaveCount(1);
});

test("owner/admin 可撤销 pending 邀请", async ({ page }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-C" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("revoke");
  await page.getByTestId("invite-email").fill(invitee);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();

  await page.getByTestId(`revoke-invite-${invitee}`).click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toHaveCount(0);
});

test("member 调用邀请 API → 403", async ({ page, playwright, baseURL }) => {
  const { ctx: owner, userId: _ownerId } = await newUserCtx(playwright, baseURL!);
  const room = (await (await owner.post("/api/rooms", { data: { name: "F09-D" } })).json()).room;

  // 当前 page 用户注册并被加入房间为 member
  await registerOnPage(page);
  const me = await (await page.request.get("/api/auth/session")).json();
  await owner.post(`/api/rooms/${room.id}/members`, { data: { userId: me.user.id } });

  const res = await page.request.post(`/api/rooms/${room.id}/members`, {
    data: { email: uniq("blocked") },
  });
  expect(res.status()).toBe(403);

  await owner.dispose();
});

test("被邀者注册成功后自动入房，登录即见该房间", async ({ page, playwright, baseURL }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-E" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("autojoin");
  await page.getByTestId("invite-email").fill(invitee);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();

  // 被邀者注册：用独立的 API 上下文，避免覆盖 owner 在 page 里的 session cookie。
  const inviteeCtx = await playwright.request.newContext({ baseURL });
  const regRes = await inviteeCtx.post("/api/auth/register", {
    data: { firstName: "In", lastName: "Vitee", email: invitee, password: "secret123", agreeTerms: true },
  });
  expect(regRes.ok()).toBeTruthy();

  // owner 视角：pending 列表刷新后应不再包含该邀请；成员列表应包含新成员。
  await page.reload();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toHaveCount(0);
  await expect(page.getByTestId("member-list")).toContainText(invitee);

  // 被邀者自己的会话也确实能看到该房间（登录即见房间）。
  const meRoom = await (await inviteeCtx.get(`/api/rooms/${room.id}/members`)).json();
  expect(meRoom.myRole).toBe("member");

  await inviteeCtx.dispose();
});

test("令牌过期：注册仍成功但不自动入房", async ({ page, playwright, baseURL }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-F" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("expired");
  await page.getByTestId("invite-email").fill(invitee);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();

  // dev-only：强制过期该邀请
  const expireRes = await page.request.post("/api/dev/expire-room-invite", { data: { email: invitee } });
  expect(expireRes.ok()).toBeTruthy();

  // 注册仍应成功（独立上下文，避免覆盖 owner 的 session cookie）
  const inviteeCtx = await playwright.request.newContext({ baseURL });
  const regRes = await inviteeCtx.post("/api/auth/register", {
    data: { firstName: "Ex", lastName: "Pired", email: invitee, password: "secret123", agreeTerms: true },
  });
  expect(regRes.ok()).toBeTruthy();

  // 但不应自动入房：owner 侧成员列表不含该邮箱
  await page.reload();
  await expect(page.getByTestId("member-list")).not.toContainText(invitee);

  // 被邀者自己也确实看不到该房间（无权限）
  const meRoom = await (await inviteeCtx.get(`/api/rooms/${room.id}/members`)).json();
  expect(meRoom.error).toBe("无权限");

  await inviteeCtx.dispose();
});
