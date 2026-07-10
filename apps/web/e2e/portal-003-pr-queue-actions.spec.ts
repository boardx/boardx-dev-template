import { test, expect } from "@playwright/test";

// p23/F04 — 谁在干活（agent + 正在做什么 + 🟢🟡🔴 心跳状态点，时间悬停）
// 与 PR 队列（按状态分组、超 3h 未动红框高亮 + 催办/认领 review/去 GitHub 行动按钮）。
// 界面契约 = p23 ui-signoff（confirmed 2026-07-09）v3 原型 PulseTab。

const uniq = () => `p23f04_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndGotoPortal(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Queue", lastName: "Dev", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function mockPulse(page: import("@playwright/test").Page) {
  return page.route("**/api/portal/pulse", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        phases: { items: [{ id: "p23", name: "developer-portal", passing: 2, total: 8 }], totals: { passing: 2, total: 8 } },
        coord: {
          configured: true,
          active_claims: [
            { resource_id: "role:coord-main", agent_id: "coord-main", last_heartbeat_at: minutesAgo(0.5), ttl_seconds: 21600 },
            { resource_id: "issue:497", agent_id: "coord-architecture", last_heartbeat_at: minutesAgo(12), ttl_seconds: 21600 },
            { resource_id: "issue:455", agent_id: "wrk-room-1", last_heartbeat_at: minutesAgo(41), ttl_seconds: 10800 },
          ],
        },
        github: { configured: false },
        generated_at: new Date().toISOString(),
      }),
    })
  );
}

function mockPrs(page: import("@playwright/test").Page) {
  return page.route("**/api/portal/prs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        items: [
          { number: 478, title: "lock/module-lock 续约语义", url: "https://github.com/boardx/x/pull/478",
            draft: false, created_at: hoursAgo(9), updated_at: hoursAgo(9) },   // 超 3h 未动 → 堵点
          { number: 488, title: "p22/F04 room 导航重组", url: "https://github.com/boardx/x/pull/488",
            draft: false, created_at: hoursAgo(0.7), updated_at: hoursAgo(0.5) }, // 新鲜
          { number: 497, title: "Portal UI 原型", url: "https://github.com/boardx/x/pull/497",
            draft: true, created_at: hoursAgo(1.1), updated_at: hoursAgo(1) },    // 草稿组
        ],
        generated_at: new Date().toISOString(),
      }),
    })
  );
}

test("谁在干活：每行 agent + 正在做什么（resource_id）+ 心跳状态点（时间在 title 悬停）", async ({ page }) => {
  await mockPulse(page);
  await mockPrs(page);
  await registerAndGotoPortal(page);

  const list = page.getByTestId("active-agents");
  await expect(list).toBeVisible();
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(3);

  // agent + 正在做什么
  await expect(rows.nth(0)).toContainText("coord-main");
  await expect(rows.nth(0)).toContainText("role:coord-main");
  await expect(rows.nth(2)).toContainText("wrk-room-1");

  // 🟢🟡🔴 三档心跳状态点：<5min 新鲜 / <30min 渐旧 / ≥30min 陈旧；时间在 title 悬停
  await expect(rows.nth(0).locator('[aria-label="心跳新鲜"]')).toBeVisible();
  await expect(rows.nth(1).locator('[aria-label="心跳渐旧"]')).toBeVisible();
  await expect(rows.nth(2).locator('[aria-label="心跳陈旧"]')).toBeVisible();
  await expect(rows.nth(0).locator('[aria-label="心跳新鲜"]')).toHaveAttribute("title", /最后心跳/);
  await expect(rows.nth(0)).toHaveAttribute("title", /最后心跳/);
});

test("PR 队列：按状态分组；超 3h 未动的行红框高亮并给出 催办/认领 review/去 GitHub 行动按钮", async ({ page }) => {
  await mockPulse(page);
  await mockPrs(page);
  await registerAndGotoPortal(page);

  const queue = page.getByTestId("pr-queue");
  await expect(queue).toBeVisible();

  // 按状态分组：评审中（2）/ 草稿（1）
  await expect(queue).toContainText("评审中（2）");
  await expect(queue).toContainText("草稿（1）");

  // 堵点行（PR 478，9h 未动）：红框高亮 + 行动按钮组
  const staleRow = queue.locator("li", { hasText: "PR 478" });
  await expect(staleRow).toContainText("超过 1 个周期（3h）未动");
  await expect(staleRow).toHaveClass(/border-destructive\/30/);
  await expect(staleRow).toHaveClass(/bg-destructive\/5/);
  const actions = staleRow.getByTestId("pr-actions");
  await expect(actions.getByRole("link", { name: "催办" })).toHaveAttribute("href", /pull\/478/);
  await expect(actions.getByRole("link", { name: "认领 review" })).toHaveAttribute("href", /pull\/478/);
  await expect(actions.getByRole("link", { name: /去 GitHub/ })).toHaveAttribute("href", /pull\/478/);

  // 新鲜行（PR 488）：无高亮、无行动按钮
  const freshRow = queue.locator("li", { hasText: "PR 488" });
  await expect(freshRow).not.toContainText("超过 1 个周期");
  await expect(freshRow.getByTestId("pr-actions")).toHaveCount(0);
});

test("诚实降级：coord/github 未配置 → 谁在干活 与 PR 队列 两卡都走 unconfigured 态", async ({ page }) => {
  // e2e 环境无 COORD_SERVICE_URL / GITHUB_TOKEN，走真实 API 的 configured:false
  await registerAndGotoPortal(page);
  await expect(page.getByTestId("phase-bars")).toBeVisible(); // phases 本地源不受拖垮
  // flow-time / 谁在干活 / PR 队列 三卡均未接线 → 各自 unconfigured（互不虚构）
  await expect(page.getByTestId("card-unconfigured")).toHaveCount(3);
  await expect(page.getByTestId("active-agents")).toHaveCount(0);
  await expect(page.getByTestId("pr-queue")).toHaveCount(0);
});
