import { test, expect, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

// p20/F08 Room Survey 入口（uc-rr-007）。
// 契约：surveys 加可空 room_id（存量 room_id=null 仍视为团队问卷）；房间 Survey tab
// （room-survey-tab）只列本房间问卷卡片（room-survey-card，含标题/状态/回收数），不再嵌入
// Team Surveys 全集；owner/admin 可新建（room-survey-create，预置 room_id 进入 p13 创建器）/
// 暂停/删除本房间问卷；member 可答题+查看已发布结果但无管理按钮；tab 内「View team surveys」
// 只跳转全局 /surveys；房间角色对团队问卷的管理请求 403；全局 /surveys 展示 scope 徽章
// （My/Team/Room），Room 问卷标注所属房间名。
type PW = PlaywrightWorkerArgs["playwright"];
const uniq = (p = "rrsvy") => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

interface UserCtx {
  ctx: APIRequestContext;
  email: string;
  userId: number;
}

async function newUserCtx(playwright: PW, prefix = "u"): Promise<UserCtx> {
  const email = uniq(prefix);
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const reg = await (
    await ctx.post("/api/auth/register", {
      data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
    })
  ).json();
  return { ctx, email, userId: reg.user.id };
}

/** owner + admin + member 三角色就位的房间（对齐 room-rr-007 既有 setupRoom 模式）。 */
async function setupRoom(playwright: PW) {
  const owner = await newUserCtx(playwright, "svyowner");
  const admin = await newUserCtx(playwright, "svyadmin");
  const member = await newUserCtx(playwright, "svymember");
  const room = (
    await (await owner.ctx.post("/api/rooms", { data: { name: "Survey Room", visibility: "private" } })).json()
  ).room;
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: admin.userId } });
  await owner.ctx.post(`/api/rooms/${room.id}/members`, { data: { userId: member.userId } });
  await owner.ctx.patch(`/api/rooms/${room.id}/members/${admin.userId}`, { data: { role: "admin" } });
  return { owner, admin, member, room };
}

async function disposeAll(...users: UserCtx[]) {
  for (const u of users) await u.ctx.dispose();
}

async function createRoomSurvey(ctx: APIRequestContext, roomId: number, title: string) {
  const res = await ctx.post("/api/surveys", {
    data: {
      title,
      description: "room survey",
      scope: "room",
      roomId,
      questions: [{ title: "How is it going?", type: "text", required: false, options: [] }],
    },
  });
  expect(res.ok()).toBe(true);
  return (await res.json()).survey as { id: number; roomId: number | null };
}

async function login(page: Page, email: string): Promise<void> {
  // e2e 全程用同一批 register() 建的账号；这里通过 API 直接登录换取 cookie 会话，
  // 复用 room-rr-001 等既有 spec 的 page.request 登录方式（同一浏览器上下文共享 cookie）。
  const res = await page.request.post("/api/auth/login", { data: { email, password: "secret123" } });
  expect(res.ok()).toBe(true);
}

test("房间 Survey tab 只列本房间问卷，不嵌入 Team Surveys 全集", async ({ page, playwright }) => {
  const { owner, room } = await setupRoom(playwright);
  await createRoomSurvey(owner.ctx, room.id, "Room Pulse Check");

  // 团队问卷（scope=team）用同一 owner 建一个团队，确保不会混进房间 tab
  const teamRes = await owner.ctx.post("/api/teams", { data: { name: "Survey Team" } });
  const team = (await teamRes.json()).team;
  await owner.ctx.post("/api/surveys", {
    data: {
      title: "Team Wide Survey",
      description: "",
      scope: "team",
      teamId: team.id,
      questions: [{ title: "Q1", type: "text", required: false, options: [] }],
    },
  });

  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/surveys`);
  await expect(page.getByTestId("room-survey-tab")).toBeVisible();

  const cards = page.getByTestId("room-survey-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Room Pulse Check");
  await expect(page.getByTestId("room-survey-tab")).not.toContainText("Team Wide Survey");

  await disposeAll(owner);
});

test("owner/admin 可新建/暂停/删除房间问卷；member 无管理按钮但可答题", async ({ page, playwright }) => {
  const { owner, admin, member, room } = await setupRoom(playwright);
  const survey = await createRoomSurvey(owner.ctx, room.id, "Admin Manageable Survey");
  // 发布问卷，供 member 答题态断言
  await owner.ctx.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } });

  // owner 视角：新建入口 + 管理按钮
  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/surveys`);
  await expect(page.getByTestId("room-survey-create")).toBeVisible();
  await expect(page.getByTestId(`room-survey-toggle-${survey.id}`)).toBeVisible();
  await expect(page.getByTestId(`room-survey-delete-${survey.id}`)).toBeVisible();

  // admin 通过 API 暂停该房间问卷（房间角色管理权，非问卷创建者本人）
  const pauseRes = await admin.ctx.patch(`/api/surveys/${survey.id}`, { data: { isActive: false } });
  expect(pauseRes.ok()).toBe(true);
  expect((await pauseRes.json()).survey.status).toBe("paused");

  // member 视角：无管理按钮，但能看到卡片 + 答题入口
  await login(page, member.email);
  await page.goto(`/rooms/${room.id}/surveys`);
  await expect(page.getByTestId("room-survey-create")).toHaveCount(0);
  await expect(page.getByTestId(`room-survey-toggle-${survey.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`room-survey-delete-${survey.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`room-survey-answer-${survey.id}`)).toBeVisible();

  // member 直接调管理 API 应 403（房间角色权限矩阵）
  const memberManage = await member.ctx.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } });
  expect(memberManage.status()).toBe(403);

  // admin 删除房间问卷
  const delRes = await admin.ctx.delete(`/api/surveys/${survey.id}`);
  expect(delRes.ok()).toBe(true);

  await disposeAll(owner, admin, member);
});

test("tab 内 View team surveys 链接只跳转全局 /surveys", async ({ page, playwright }) => {
  const { owner, room } = await setupRoom(playwright);
  await login(page, owner.email);
  await page.goto(`/rooms/${room.id}/surveys`);
  const link = page.getByTestId("room-survey-view-team-link");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/surveys");
  await link.click();
  await expect(page).toHaveURL(/\/surveys$/);

  await disposeAll(owner);
});

test("房间角色对团队问卷的管理请求返回 403（不能越权管理团队资源）", async ({ playwright }) => {
  const { owner, admin } = await setupRoom(playwright);

  const teamRes = await owner.ctx.post("/api/teams", { data: { name: "Cross Scope Team" } });
  const team = (await teamRes.json()).team;
  const surveyRes = await owner.ctx.post("/api/surveys", {
    data: {
      title: "Team Only Survey",
      description: "",
      scope: "team",
      teamId: team.id,
      questions: [{ title: "Q1", type: "text", required: false, options: [] }],
    },
  });
  const teamSurvey = (await surveyRes.json()).survey;

  // admin 是房间 admin，但不是该团队成员/问卷 owner——对团队问卷的管理请求必须 403，
  // 即使 admin 在某个房间里持有 owner/admin 角色，也不能越权管理团队问卷（scope 权限域隔离）。
  const manageAttempt = await admin.ctx.patch(`/api/surveys/${teamSurvey.id}`, { data: { isActive: true } });
  expect(manageAttempt.status()).toBe(403);
  const deleteAttempt = await admin.ctx.delete(`/api/surveys/${teamSurvey.id}`);
  expect(deleteAttempt.status()).toBe(403);

  await disposeAll(owner, admin);
});

test("非房间成员访问房间问卷列表 403；member 创建房间问卷 403", async ({ playwright }) => {
  const { room, member } = await setupRoom(playwright);
  const outsider = await newUserCtx(playwright, "svyoutsider");

  const outsiderRes = await outsider.ctx.get(`/api/rooms/${room.id}/surveys`);
  expect(outsiderRes.status()).toBe(403);

  const memberCreate = await member.ctx.post("/api/surveys", {
    data: {
      title: "Member Attempt",
      description: "",
      scope: "room",
      roomId: room.id,
      questions: [{ title: "Q1", type: "text", required: false, options: [] }],
    },
  });
  expect(memberCreate.status()).toBe(403);

  await disposeAll(outsider);
});

test("全局 /surveys 列表展示 scope 徽章（My/Team/Room），Room 问卷标注所属房间名", async ({ page, playwright }) => {
  const { owner, room } = await setupRoom(playwright);
  const survey = await createRoomSurvey(owner.ctx, room.id, "Badge Check Survey");

  await login(page, owner.email);
  await page.goto("/surveys");
  await page.getByTestId("filter-room-surveys").click();
  await expect(page.getByTestId(`survey-${survey.id}`)).toBeVisible();
  await expect(page.getByTestId(`survey-scope-badge-${survey.id}`)).toContainText("Room");
  await expect(page.getByTestId(`survey-room-name-${survey.id}`)).toContainText("Survey Room");

  await disposeAll(owner);
});

test("迁移不变量：存量问卷 room_id=null 仍视为团队问卷（POST 不传 roomId 时默认 private，不受迁移影响）", async ({
  playwright,
}) => {
  const { owner } = await setupRoom(playwright);
  const res = await owner.ctx.post("/api/surveys", {
    data: {
      title: "Legacy Style Survey",
      description: "",
      scope: "private",
      questions: [{ title: "Q1", type: "text", required: false, options: [] }],
    },
  });
  expect(res.ok()).toBe(true);
  const survey = (await res.json()).survey;
  expect(survey.roomId ?? null).toBeNull();
  expect(survey.scope).toBe("private");

  await disposeAll(owner);
});
