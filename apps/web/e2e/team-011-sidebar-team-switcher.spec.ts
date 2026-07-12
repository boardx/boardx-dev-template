import { test, expect } from "@playwright/test";

// uc-team-002「前端入口：左侧团队头像菜单」（issue #589）。
// 覆盖：菜单展开（当前团队头部 + Team List + Manage/Create 入口）、点击其它团队切换
// 并回到 Home、当前团队选中标记（A1 由组件层保证：点当前团队只关菜单不发请求）、
// 无团队空态（E1）。切换鉴权（不能切到未加入团队）已由 team-switch.spec.ts 覆盖 API 层。

const uniq = () => `tsw_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Tia", lastName: "Switch", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("侧栏团队菜单：展开显示当前团队与列表，切换后进入 Home 且上下文更新", async ({ page }) => {
  await register(page);
  const t1 = await (await page.request.post("/api/teams", { data: { name: "Alpha Team" } })).json();
  const t2 = await (await page.request.post("/api/teams", { data: { name: "Beta Team" } })).json();
  // 建队接口会把最后创建的 t2 设为当前团队。

  await page.goto("/");
  await page.getByTestId("team-switcher").click();
  await expect(page.getByTestId("team-switcher-popup")).toBeVisible();

  // 菜单顶部：当前团队名 + 角色/类型（主流程第 2 步）。
  await expect(page.getByTestId("team-switcher-current")).toContainText("Beta Team");
  await expect(page.getByTestId("team-switcher-current")).toContainText("owner");

  // Team List：两个团队都在，当前团队带选中标记。
  await expect(page.getByTestId(`team-switcher-item-${t1.team.id}`)).toContainText("Alpha Team");
  await expect(page.getByTestId(`team-switcher-item-${t2.team.id}`)).toHaveAttribute("aria-current", "true");

  // Manage / Create 入口存在（第 3 步）。
  await expect(page.getByTestId("team-switcher-manage")).toBeVisible();
  await expect(page.getByTestId("team-switcher-create")).toBeVisible();

  // 切到 t1：等 POST 完成，整页跳转回 Home（第 5-7 步）。
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/teams/current") && r.request().method() === "POST"),
    page.getByTestId(`team-switcher-item-${t1.team.id}`).click(),
  ]);

  // 服务端上下文已切换（后置条件）：GET /api/teams/current 返回 t1。
  const cur = await (await page.request.get("/api/teams/current")).json();
  expect(String(cur.teamId)).toBe(String(t1.team.id));

  // 组件用 window.location.href="/" 整页跳转；从 "/" 切换时 URL 不变，无法用
  // waitForURL 判定加载完成，这里显式 reload 取服务端最新状态再断言（与
  // team-switch.spec.ts 同一做法）。
  await page.goto("/");

  // 重新打开菜单：t1 现在是当前团队（选中标记 + 头部名称）。
  await page.getByTestId("team-switcher").click();
  await expect(page.getByTestId(`team-switcher-item-${t1.team.id}`)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("team-switcher-current")).toContainText("Alpha Team");
});

test("E1：未加入任何团队时，菜单展示空态与创建入口", async ({ page }) => {
  await register(page);
  await page.goto("/");
  await page.getByTestId("team-switcher").click();
  await expect(page.getByTestId("team-switcher-popup")).toBeVisible();
  await expect(page.getByTestId("team-switcher-empty")).toBeVisible();
  await expect(page.getByTestId("team-switcher-create")).toBeVisible();
});

test("A1：点击当前团队不重复切换（不发 POST，只收起菜单）", async ({ page }) => {
  await register(page);
  const t = await (await page.request.post("/api/teams", { data: { name: "Solo Team" } })).json();

  await page.goto("/");
  await page.getByTestId("team-switcher").click();
  await expect(page.getByTestId(`team-switcher-item-${t.team.id}`)).toHaveAttribute("aria-current", "true");

  let posted = false;
  page.on("request", (r) => {
    if (r.url().includes("/api/teams/current") && r.method() === "POST") posted = true;
  });
  await page.getByTestId(`team-switcher-item-${t.team.id}`).click();
  await expect(page.getByTestId("team-switcher-popup")).toHaveCount(0);
  expect(posted).toBe(false);
});
