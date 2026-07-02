import { test, expect } from "@playwright/test";

const uniq = () => `ts_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";

test("创建两个团队并切换当前团队", async ({ page }) => {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  const t1 = await (await page.request.post("/api/teams", { data: { name: "Team One" } })).json();
  const t2 = await (await page.request.post("/api/teams", { data: { name: "Team Two" } })).json();

  await page.goto("/teams");
  // 切到 t1（点击后等接口完成，再 reload 取服务端最新状态断言）
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/teams/current") && r.request().method() === "POST"),
    page.getByTestId(`switch-${t1.team.id}`).click(),
  ]);
  await page.reload();
  await expect(page.getByTestId(`team-${t1.team.id}`)).toContainText("当前");
  // 切到 t2
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/teams/current") && r.request().method() === "POST"),
    page.getByTestId(`switch-${t2.team.id}`).click(),
  ]);
  await page.reload();
  await expect(page.getByTestId(`team-${t2.team.id}`)).toContainText("当前");
});

test("不能切换到未加入的团队", async ({ page, playwright }) => {
  // 用户 A 建团队
  const a = await playwright.request.newContext({ baseURL: BASE_URL });
  await a.post("/api/auth/register", {
    data: { firstName: "A", lastName: "A", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const teamA = await (await a.post("/api/teams", { data: { name: "A's Team" } })).json();
  // 用户 B 尝试切到 A 的团队 → 403
  await page.request.post("/api/auth/register", {
    data: { firstName: "B", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/teams/current", { data: { teamId: teamA.team.id } });
  expect(res.status()).toBe(403);
  await a.dispose();
});
