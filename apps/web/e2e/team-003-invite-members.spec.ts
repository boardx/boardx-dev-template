import { test, expect, type APIRequestContext } from "@playwright/test";

// uc-team-003-invite-members：owner 用邮箱邀请成员 / 复制邀请链接；未登录跳 /login。
const uniq = (p = "t3") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

async function registerOnPage(page: import("@playwright/test").Page, email = uniq()) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  return email;
}

async function newUserCtx(playwright: any): Promise<{ ctx: APIRequestContext; email: string }> {
  const email = uniq("guest");
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  await ctx.post("/api/auth/register", {
    data: { firstName: "G", lastName: "G", email, password: "secret123", agreeTerms: true },
  });
  return { ctx, email };
}

test("owner 邮箱邀请：已注册用户被加入，未注册邮箱走邀请流程", async ({ page, playwright }) => {
  await registerOnPage(page);
  // 预先注册一个 guest（已注册用户）
  const { ctx: guest, email: guestEmail } = await newUserCtx(playwright);

  await page.goto("/teams");
  await page.getByTestId("team-name").fill("Invite Team");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("team-list")).toContainText("Invite Team");

  // 邀请区可见
  await expect(page.getByTestId("invite-section")).toBeVisible();

  // 已注册邮箱 → 直接加入团队
  await page.getByTestId("invite-email").fill(guestEmail);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`invite-result-${guestEmail}`)).toContainText("已加入团队");

  // 未注册邮箱 → 邀请流程处理（邀请已发送）
  const strangerEmail = uniq("stranger");
  await page.getByTestId("invite-email").fill(strangerEmail);
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId(`invite-result-${strangerEmail}`)).toContainText("邀请已发送");

  await guest.dispose();
});

test("复制邀请链接：写入剪贴板并提示已复制", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await registerOnPage(page);
  await page.goto("/teams");
  await page.getByTestId("team-name").fill("Link Team");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("invite-section")).toBeVisible();

  await page.getByTestId("copy-invite-link").click();
  await expect(page.getByTestId("copy-ok")).toBeVisible();

  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("/teams/join?token=");
});

test("邮箱格式无效 → invalidEmail；空邮箱 → 提示请输入邮箱", async ({ page }) => {
  await registerOnPage(page);
  await page.goto("/teams");
  await page.getByTestId("team-name").fill("Err Team");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("invite-section")).toBeVisible();

  // 无效格式
  await page.getByTestId("invite-email").fill("not-an-email");
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId("invite-err")).toContainText("invalidEmail");

  // 空邮箱
  await page.getByTestId("invite-email").fill("");
  await page.getByTestId("invite-submit").click();
  await expect(page.getByTestId("invite-err")).toContainText("请输入邮箱地址");
});

test("未登录访问 /teams → 跳 /login", async ({ page }) => {
  await page.goto("/teams");
  await expect(page).toHaveURL(/\/login/);
});

test("API：member 无权邮箱邀请 → 403", async ({ playwright }) => {
  const { ctx: owner } = await newUserCtx(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Perm" } })).json()).team;
  const invite = await (await owner.post(`/api/teams/${team.id}/invites`, { data: {} })).json();
  const { ctx: member, email: memberEmail } = await newUserCtx(playwright);
  await member.post("/api/teams/join", { data: { token: invite.token } });
  // member 通过邮箱邀请接口 → 403
  const res = await member.post("/api/teams/invite", {
    data: { teamId: team.id, email: uniq("x") },
  });
  expect(res.status()).toBe(403);
  void memberEmail;
  await owner.dispose();
  await member.dispose();
});

test("API：已在团队的成员被重复邀请 → userAlreadyInTeam(409)", async ({ playwright }) => {
  const { ctx: owner } = await newUserCtx(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Dup" } })).json()).team;
  const { ctx: guest, email: guestEmail } = await newUserCtx(playwright);
  // 第一次邀请加入
  const first = await owner.post("/api/teams/invite", { data: { teamId: team.id, email: guestEmail } });
  expect((await first.json()).status).toBe("added");
  // 再次邀请同一人 → 409
  const second = await owner.post("/api/teams/invite", { data: { teamId: team.id, email: guestEmail } });
  expect(second.status()).toBe(409);
  expect((await second.json()).error).toBe("userAlreadyInTeam");
  await owner.dispose();
  await guest.dispose();
});
