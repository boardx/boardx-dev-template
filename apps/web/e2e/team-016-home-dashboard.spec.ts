import { test, expect, type Page } from "@playwright/test";

const uniq = () => `th_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndTeam(page: Page, teamName: string) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Team", lastName: "Home", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/teams", { data: { name: teamName } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).team as { id: number; name: string };
}

// 04-F16：Team 管理页 Home——Dashboard 统计卡片 + 管理入口卡片 + AI Store 分组。
test("团队 Home 显示四张统计卡片与管理/AI Store 入口，统计取当前团队", async ({ page }) => {
  const team = await registerAndTeam(page, `Dash Team ${Date.now()}`);

  // 造一个 team-scope 已发布 Agent，让 AI Tools 统计非零。
  const item = await page.request.post("/api/ai-store/items", {
    data: { type: "agent", scope: "team", action: "publish", name: "Team Tool", description: "d", tags: [], examples: [], config: {} },
  });
  expect(item.ok()).toBeTruthy();

  // 从 /teams 列表的 Manage 入口进入。
  await page.goto("/teams");
  await page.getByTestId(`manage-${team.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/teams/${team.id}$`));

  await expect(page.getByTestId("team-home")).toBeVisible();
  await expect(page.getByTestId("team-home-name")).toContainText(team.name);

  // 四张统计卡片：owner 视角全部有数值（成员 1、AI Tools 1、待审 0、Tokens 0）。
  await expect(page.getByTestId("stat-active-members")).toContainText("1");
  await expect(page.getByTestId("stat-ai-tools")).toContainText("1");
  await expect(page.getByTestId("stat-pending-reviews")).toContainText("0");
  await expect(page.getByTestId("stat-total-tokens")).toContainText("0");

  // 管理入口卡片。
  for (const id of ["entry-general", "entry-members", "entry-credits", "entry-knowledge", "entry-surveys"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  // AI Store 分组三入口。
  await expect(page.getByTestId("store-explore")).toBeVisible();
  await expect(page.getByTestId("store-subscribe")).toBeVisible();
  await expect(page.getByTestId("store-approval")).toBeVisible();
});

test("Store Subscribe 入口带团队上下文直达订阅视图；Store Approval 进审批页", async ({ page }) => {
  const team = await registerAndTeam(page, `Store Team ${Date.now()}`);
  await page.goto(`/teams/${team.id}`);

  await page.getByTestId("store-subscribe").click();
  // store-browser 挂载后会用 history.replaceState 清掉 ?nav 参数，断言最终视图即可。
  await expect(page.getByTestId("subscribe-view")).toBeVisible();
  await expect(page).toHaveURL(/\/ai-store/);

  await page.goto(`/teams/${team.id}`);
  await page.getByTestId("store-approval").click();
  await expect(page).toHaveURL(new RegExp(`/teams/${team.id}/ai-store-review`));
});

test("非团队成员访问团队 Home 显示无权限", async ({ page }) => {
  const team = await registerAndTeam(page, `Priv Team ${Date.now()}`);
  // 换一个新用户（未加入该团队）。
  await page.request.post("/api/auth/register", {
    data: { firstName: "Out", lastName: "Sider", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/teams/${team.id}`);
  await expect(page.getByTestId("team-home-forbidden")).toBeVisible();
});
