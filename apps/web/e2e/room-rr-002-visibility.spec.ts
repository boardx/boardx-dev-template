// p20/F02 创建房间时选择可见性（uc-rr-002）
// 契约：New Room 表单含房间名输入（≥3 字符）与可见性二选一卡片
// （data-testid=room-create-visibility-private / room-create-visibility-team，默认 Private）；
// 提交 POST /api/rooms 落库 visibility；列表卡片按可见性显示 🔒/🌐 徽章；
// visibility=team 的房间对同团队成员可发现并可加入成为 member；private 房间对非成员不可见。
import { test, expect, type Page, type APIRequestContext, type PlaywrightWorkerArgs } from "@playwright/test";

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

async function newUserCtx(
  playwright: PlaywrightWorkerArgs["playwright"],
  prefix: string
): Promise<{ ctx: APIRequestContext; email: string }> {
  const ctx = await playwright.request.newContext({ baseURL: BASE_URL });
  const email = uniq(prefix);
  const res = await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return { ctx, email };
}

test("New Room 表单：可见性二选一卡片默认 Private；名称 <3 字符禁用提交并提示", async ({ page }) => {
  await register(page, "rrviz1");
  await page.goto("/rooms");
  await page.getByTestId("show-create").click();

  // 二选一卡片存在，默认选中 Private
  const privateCard = page.getByTestId("room-create-visibility-private");
  const teamCard = page.getByTestId("room-create-visibility-team");
  await expect(privateCard).toBeVisible();
  await expect(teamCard).toBeVisible();
  await expect(privateCard).toHaveAttribute("aria-checked", "true");
  await expect(teamCard).toHaveAttribute("aria-checked", "false");

  // 名称 <3 字符：提交禁用 + 错误提示
  await page.getByTestId("room-name").fill("ab");
  await expect(page.getByTestId("create")).toBeDisabled();
  await expect(page.getByTestId("room-name-hint")).toBeVisible();

  // 名称合法后可提交，默认 Private 落库，列表卡片显示 🔒 徽章
  await page.getByTestId("room-name").fill("Lock Room");
  await expect(page.getByTestId("create")).toBeEnabled();
  await page.getByTestId("create").click();
  await expect(page.getByTestId("room-list")).toContainText("Lock Room");

  const rooms = (await (await page.request.get("/api/rooms")).json()).rooms as Array<{
    id: number; name: string; visibility: string;
  }>;
  const room = rooms.find((r) => r.name === "Lock Room");
  expect(room).toBeTruthy();
  expect(room!.visibility).toBe("private");
  await expect(page.getByTestId(`room-visibility-badge-${room!.id}`)).toContainText("🔒");
});

test("选 Team 卡片创建：POST /api/rooms 落库 visibility=team，列表卡片显示 🌐 徽章", async ({ page }) => {
  await register(page, "rrviz2");
  await page.goto("/rooms");
  await page.getByTestId("show-create").click();

  await page.getByTestId("room-name").fill("Open Space");
  await page.getByTestId("room-create-visibility-team").click();
  await expect(page.getByTestId("room-create-visibility-team")).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("room-create-visibility-private")).toHaveAttribute("aria-checked", "false");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("room-list")).toContainText("Open Space");

  const rooms = (await (await page.request.get("/api/rooms")).json()).rooms as Array<{
    id: number; name: string; visibility: string;
  }>;
  const room = rooms.find((r) => r.name === "Open Space");
  expect(room).toBeTruthy();
  expect(room!.visibility).toBe("team");
  await expect(page.getByTestId(`room-visibility-badge-${room!.id}`)).toContainText("🌐");
});

test("team 房间对同团队成员可发现并可加入成为 member；非团队成员不可见不可加入", async ({ page, playwright }) => {
  // owner 建团队（cookie 落团队上下文）→ 邀请 member → 建 team 可见房间
  const owner = await newUserCtx(playwright, "rrvizown");
  const team = (await (await owner.ctx.post("/api/teams", { data: { name: "Viz Team" } })).json()).team;

  const memberEmail = await register(page, "rrvizmem");
  const invite = await owner.ctx.post("/api/teams/invite", { data: { teamId: team.id, email: memberEmail } });
  expect(invite.ok()).toBe(true);

  // owner 在团队上下文创建 team 可见房间（不显式传 teamId，走当前团队上下文）
  const created = await owner.ctx.post("/api/rooms", { data: { name: "Team Discoverable", visibility: "team" } });
  expect(created.status()).toBe(201);
  const room = (await created.json()).room;
  expect(String(room.team_id)).toBe(String(team.id));

  // 同团队成员：列表可发现（带 Join 入口），加入后成为 member
  await page.goto("/rooms");
  await expect(page.getByTestId(`room-${room.id}`)).toBeVisible();
  await expect(page.getByTestId(`room-${room.id}`)).toContainText("🌐");
  const joinBtn = page.getByTestId(`room-join-${room.id}`);
  await expect(joinBtn).toBeVisible();
  await joinBtn.click();
  // 加入成功后 Join 入口消失
  await expect(page.getByTestId(`room-join-${room.id}`)).toHaveCount(0);

  // 已是 member：members 列表含自己，角色 member
  const membersRes = await page.request.get(`/api/rooms/${room.id}/members`);
  expect(membersRes.status()).toBe(200);
  const membersData = await membersRes.json();
  expect(membersData.myRole).toBe("member");
  expect(membersData.members.some((m: { email: string }) => m.email === memberEmail.toLowerCase())).toBe(true);

  // 非团队成员：列表不可见，join 403
  const stranger = await newUserCtx(playwright, "rrvizstr");
  const strangerList = (await (await stranger.ctx.get("/api/rooms")).json()).rooms as Array<{ id: number }>;
  expect(strangerList.some((r) => String(r.id) === String(room.id))).toBe(false);
  expect((await stranger.ctx.post(`/api/rooms/${room.id}/join`)).status()).toBe(403);

  await owner.ctx.dispose();
  await stranger.ctx.dispose();
});

test("反例：private 房间对同团队非成员不可见、不可加入（现有行为不被破坏）", async ({ playwright }) => {
  const owner = await newUserCtx(playwright, "rrvizpo");
  const team = (await (await owner.ctx.post("/api/teams", { data: { name: "Priv Team" } })).json()).team;

  const mate = await newUserCtx(playwright, "rrvizpm");
  const invite = await owner.ctx.post("/api/teams/invite", { data: { teamId: team.id, email: mate.email } });
  expect(invite.ok()).toBe(true);

  // owner 在团队上下文建 private 房间
  const room = (await (await owner.ctx.post("/api/rooms", { data: { name: "Team Secret", visibility: "private" } })).json()).room;
  expect(String(room.team_id)).toBe(String(team.id));

  // 同团队成员（非房间成员）：列表不可见、直接访问 403、join 403
  const list = (await (await mate.ctx.get("/api/rooms")).json()).rooms as Array<{ id: number }>;
  expect(list.some((r) => String(r.id) === String(room.id))).toBe(false);
  expect((await mate.ctx.get(`/api/rooms/${room.id}`)).status()).toBe(403);
  expect((await mate.ctx.post(`/api/rooms/${room.id}/join`)).status()).toBe(403);

  await owner.ctx.dispose();
  await mate.ctx.dispose();
});
