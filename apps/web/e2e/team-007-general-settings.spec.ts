import { test, expect, type APIRequestContext } from "@playwright/test";

// uc-team-007 — 团队常规设置（General）：owner 改名/描述、owner 删团队、非 owner 无权删。
// 沿用 team-manage.spec 的 API 约定：PATCH/DELETE /api/teams/[id]。

const uniq = () => `tg_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function newUser(playwright: any): Promise<APIRequestContext> {
  const ctx = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
  await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  return ctx;
}

async function ownerWithMember(playwright: any) {
  const owner = await newUser(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Gen" } })).json()).team;
  const invite = await (await owner.post(`/api/teams/${team.id}/invites`, { data: {} })).json();
  const member = await newUser(playwright);
  await member.post("/api/teams/join", { data: { token: invite.token } });
  return { owner, member, team };
}

test("owner 编辑团队名与描述 → 保存成功并持久化", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Before" } })).json()).team;

  const res = await owner.patch(`/api/teams/${team.id}`, {
    data: { name: "After Name", description: "团队描述更新" },
  });
  expect(res.status()).toBe(200);

  const teams = (await (await owner.get("/api/teams")).json()).teams as Array<{
    id: number;
    name: string;
    description: string;
  }>;
  const updated = teams.find((t) => t.id === team.id)!;
  expect(updated.name).toBe("After Name");
  expect(updated.description).toBe("团队描述更新");

  await owner.dispose();
});

test("owner 删除团队 → 团队从列表消失", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "ToDelete" } })).json()).team;

  const del = await owner.delete(`/api/teams/${team.id}`);
  expect(del.status()).toBe(200);

  const teams = (await (await owner.get("/api/teams")).json()).teams as Array<{ id: number }>;
  expect(teams.find((t) => t.id === team.id)).toBeUndefined();

  await owner.dispose();
});

test("非 owner（member）无权删除团队 → 403", async ({ playwright }) => {
  const { owner, member, team } = await ownerWithMember(playwright);

  const del = await member.delete(`/api/teams/${team.id}`);
  expect(del.status()).toBe(403);

  // 团队仍在 owner 列表中
  const teams = (await (await owner.get("/api/teams")).json()).teams as Array<{ id: number }>;
  expect(teams.find((t) => t.id === team.id)).toBeDefined();

  await owner.dispose();
  await member.dispose();
});

test("团队名不能为空 → 400", async ({ playwright }) => {
  const owner = await newUser(playwright);
  const team = (await (await owner.post("/api/teams", { data: { name: "Keep" } })).json()).team;

  const res = await owner.patch(`/api/teams/${team.id}`, { data: { name: "  ", description: "x" } });
  expect(res.status()).toBe(400);

  await owner.dispose();
});

test("General 设置区在 /teams 页面可见（owner）", async ({ page }) => {
  // 用 page.request 注册 → 自动建立 page 上下文登录态（register 内 startSession）
  await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/teams");
  // owner 创建团队后 General 区出现
  await page.getByTestId("team-name").fill("Visible Team");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("team-general")).toBeVisible();
  await expect(page.getByTestId("general-name")).toBeVisible();
  await expect(page.getByTestId("general-description")).toBeVisible();
  await expect(page.getByTestId("danger-zone")).toBeVisible();
});
