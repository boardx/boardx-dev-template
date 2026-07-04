import { test, expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

// uc-rr-008 / p20 F09：邀请未注册用户加入房间（完整流）。
// 覆盖：未注册邮箱邀请落库 + pending 列表可见、重复邀请幂等（不重复行）、撤销、
// member 邀请 403、token 消费入房（登录即见房间）、过期令牌不入房但提示、
// 以及 review 修复后的安全回归：没有正确 token 不能靠邮箱冒领邀请。
const uniq = (p = "f09") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerOnPage(page: Page, email = uniq()) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
  return email;
}

async function newUserCtx(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string): Promise<{ ctx: APIRequestContext; email: string; userId: number }> {
  const email = uniq("owner");
  const ctx = await playwright.request.newContext({ baseURL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "G", lastName: "G", email, password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, email, userId: reg.user.id };
}

/** 从 dev outbox 读出邀请邮件正文里的注册链接 token（e2e 断言用，不走真实收件箱）。 */
async function readInviteToken(page: Page, email: string): Promise<string> {
  const outbox = await (
    await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}&kind=room_invite`)
  ).json();
  const body: string = outbox.mail?.body ?? "";
  const match = body.match(/[?&]token=([^&\s]+)/);
  expect(match, `invite email body should contain a token param: ${body}`).toBeTruthy();
  return decodeURIComponent(match![1]!);
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

  // dev 邮件通道确实"发出"了邀请邮件（落库 + 含带 token 的注册链接）
  const token = await readInviteToken(page, invitee);
  expect(token.length).toBeGreaterThan(20); // generateToken() = randomBytes(32).hex，远长于可猜测串
});

test("重复邀请同一邮箱：幂等刷新 token/过期时间，不产生重复行", async ({ page }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-B" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("dup");
  const tokens: string[] = [];
  for (let i = 0; i < 2; i++) {
    await page.getByTestId("invite-email").fill(invitee);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/rooms/${room.id}/members`) && r.request().method() === "POST"),
      page.getByTestId("invite-submit").click(),
    ]);
    expect((await res.json()).status).toBe("invited");
    await expect(page.getByTestId(`invite-result-${invitee}`)).toContainText("邀请已发送");
    tokens.push(await readInviteToken(page, invitee));
  }

  // 只有一条 pending 记录（data-testid 唯一，count=1）
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toHaveCount(1);
  // 幂等刷新：第二次邀请拿到的是新 token，旧 token 已失效（同一行被覆盖）。
  expect(tokens[0]).not.toBe(tokens[1]);
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

test("被邀者带正确 token 注册：自动入房，登录即见该房间", async ({ page, playwright, baseURL }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-E" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("autojoin");
  await page.getByTestId("invite-email").fill(invitee);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();
  const token = await readInviteToken(page, invitee);

  // 被邀者注册：用独立的 API 上下文，避免覆盖 owner 在 page 里的 session cookie。
  // 必须带上邀请邮件里的 token 才会入房（这正是本轮 review 修复的核心）。
  const inviteeCtx = await playwright.request.newContext({ baseURL });
  const regRes = await inviteeCtx.post("/api/auth/register", {
    data: {
      firstName: "In",
      lastName: "Vitee",
      email: invitee,
      password: "secret123",
      agreeTerms: true,
      roomInviteToken: token,
    },
  });
  expect(regRes.ok()).toBeTruthy();
  const regBody = await regRes.json();
  expect(regBody.roomInvite?.status).toBe("joined");
  expect(regBody.roomInvite?.roomId).toBe(room.id);

  // owner 视角：pending 列表刷新后应不再包含该邀请；成员列表应包含新成员。
  await page.reload();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toHaveCount(0);
  await expect(page.getByTestId("member-list")).toContainText(invitee);

  // 被邀者自己的会话也确实能看到该房间（登录即见房间）。
  const meRoom = await (await inviteeCtx.get(`/api/rooms/${room.id}/members`)).json();
  expect(meRoom.myRole).toBe("member");

  await inviteeCtx.dispose();
});

test("安全回归：不带 token（或邮箱匹配但 token 错误）注册，不能冒领邀请入房", async ({ page, playwright, baseURL }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-G" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("nosecret");
  await page.getByTestId("invite-email").fill(invitee);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();

  // 攻击者场景 1：知道被邀邮箱，但不知道 token —— 完全不带 roomInviteToken 注册。
  const attackerCtx = await playwright.request.newContext({ baseURL });
  const regRes = await attackerCtx.post("/api/auth/register", {
    data: { firstName: "At", lastName: "Tacker", email: invitee, password: "secret123", agreeTerms: true },
  });
  expect(regRes.ok()).toBeTruthy();
  const regBody = await regRes.json();
  expect(regBody.roomInvite).toBeNull();

  // 不应该被加入房间。
  const meRoom = await (await attackerCtx.get(`/api/rooms/${room.id}/members`)).json();
  expect(meRoom.error).toBe("无权限");

  // owner 视角：pending 邀请还在（没有被这次"冒领尝试"消费掉）。
  await page.reload();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();
  await expect(page.getByTestId("member-list")).not.toContainText(invitee);

  await attackerCtx.dispose();
});

test("令牌过期：注册仍成功但不自动入房，并在注册页提示邀请已过期", async ({ page, playwright, baseURL }) => {
  await registerOnPage(page);
  const room = (await (await page.request.post("/api/rooms", { data: { name: "F09-F" } })).json()).room;
  await page.goto(`/rooms/${room.id}/members`);

  const invitee = uniq("expired");
  await page.getByTestId("invite-email").fill(invitee);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`pending-invite-${invitee}`)).toBeVisible();
  const token = await readInviteToken(page, invitee);

  // dev-only：owner/admin 权限下强制过期该房间对该邮箱的邀请（现在按 room_id+email 收敛）。
  const expireRes = await page.request.post("/api/dev/expire-room-invite", {
    data: { email: invitee, roomId: room.id },
  });
  expect(expireRes.ok()).toBeTruthy();

  // 注册仍应成功（独立上下文，避免覆盖 owner 的 session cookie），API 层面报告 status: expired。
  const inviteeCtx = await playwright.request.newContext({ baseURL });
  const regRes = await inviteeCtx.post("/api/auth/register", {
    data: {
      firstName: "Ex",
      lastName: "Pired",
      email: invitee,
      password: "secret123",
      agreeTerms: true,
      roomInviteToken: token,
    },
  });
  expect(regRes.ok()).toBeTruthy();
  const regBody = await regRes.json();
  expect(regBody.roomInvite?.status).toBe("expired");
  expect(regBody.roomInvite?.roomName).toBe("F09-F");

  // 但不应自动入房：owner 侧成员列表不含该邮箱
  await page.reload();
  await expect(page.getByTestId("member-list")).not.toContainText(invitee);

  // 被邀者自己也确实看不到该房间（无权限）
  const meRoom = await (await inviteeCtx.get(`/api/rooms/${room.id}/members`)).json();
  expect(meRoom.error).toBe("无权限");

  await inviteeCtx.dispose();
});

test("注册页：携带过期 token 注册后展示「邀请已过期」提示（uc-rr-008 E1）", async ({ page, playwright, baseURL }) => {
  const { ctx: owner } = await newUserCtx(playwright, baseURL!);
  const room = (await (await owner.post("/api/rooms", { data: { name: "F09-H" } })).json()).room;

  const invitee = uniq("expiredui");
  await owner.post(`/api/rooms/${room.id}/members`, { data: { email: invitee } });
  const outbox = await (
    await owner.get(`/api/dev/outbox?to=${encodeURIComponent(invitee)}&kind=room_invite`)
  ).json();
  const bodyText: string = outbox.mail?.body ?? "";
  const token = decodeURIComponent(bodyText.match(/[?&]token=([^&\s]+)/)![1]!);

  await owner.post("/api/dev/expire-room-invite", { data: { email: invitee, roomId: room.id } });

  await page.goto(`/register?email=${encodeURIComponent(invitee)}&token=${encodeURIComponent(token)}`);
  await expect(page.getByTestId("email")).toHaveValue(invitee);
  await page.getByTestId("firstName").fill("Ex");
  await page.getByTestId("lastName").fill("Pired");
  await page.getByTestId("password").fill("secret123");
  await page.getByTestId("agreeTerms").check();
  await page.getByTestId("submit").click();

  await expect(page.getByTestId("room-invite-expired")).toContainText("F09-H");
  await expect(page.getByTestId("room-invite-expired")).toContainText("已过期");

  await owner.dispose();
});
