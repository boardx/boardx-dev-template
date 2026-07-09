import { test, expect } from "@playwright/test";

// p23/F05 — 实时协调板块：活跃租约（Active Claims）+ 协调事件（Recent Events）两卡迁入门户。
// 界面契约 = p23 ui-signoff（confirmed）v3 原型 CoordTab：中文标题 + 术语括注；
// 租约行 🟢🟡🔴 心跳状态点（时间与 ttl 放 title 悬停）；expire destructive 徽章，
// cycle-plan/cycle-result/andon secondary 徽章。数据源 /api/portal/coordination，
// 未配置 → PortalCard unconfigured 态（诚实降级，不虚构数据）。

const uniq = () => `p23f05_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndGotoCoord(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Portal", lastName: "Coord", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: /实时协调/ }).click();
  await expect(page.getByTestId("tab-coord")).toBeVisible();
}

test("未配置 COORD_SERVICE_URL：两卡都显示 unconfigured 态而非报错（合法部署中间态）", async ({ page }) => {
  // e2e 环境不配 COORD_SERVICE_URL → 代理返回 {configured:false}
  await registerAndGotoCoord(page);
  await expect(page.getByText("活跃租约（Active Claims）")).toBeVisible();
  await expect(page.getByText("协调事件（Recent Events）")).toBeVisible();
  await expect(page.getByTestId("card-unconfigured")).toHaveCount(2);
  await expect(page.getByTestId("card-degraded")).toHaveCount(0);
});

test("配置后（mock 代理响应）：租约行心跳状态点 + title 悬停含心跳/ttl；事件徽章语义分级", async ({ page }) => {
  const now = Date.now();
  const iso = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
  await page.route("**/api/portal/coordination", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        configured: true,
        active_claims: [
          { id: 1, resource_id: "role:coord-main", agent_id: "coord-main", status: "in_progress", claimed_at: iso(120), last_heartbeat_at: iso(1), ttl_seconds: 21600 },
          { id: 2, resource_id: "issue:455", agent_id: "wrk-room-1", status: "in_progress", claimed_at: iso(300), last_heartbeat_at: iso(12), ttl_seconds: 10800 },
          { id: 3, resource_id: "role:coord-ava", agent_id: "coord-ava", status: "in_progress", claimed_at: iso(600), last_heartbeat_at: iso(45), ttl_seconds: 21600 },
        ],
        recent_events: [
          { id: 11, type: "heartbeat", resource_id: "role:coord-main", agent_id: "coord-main", payload: null, at: iso(0.5) },
          { id: 12, type: "cycle-plan", resource_id: "cycle:2026-07-09T09Z", agent_id: "coord-main", payload: null, at: iso(44) },
          { id: 13, type: "andon", resource_id: "andon:main-typecheck", agent_id: "coord-main", payload: null, at: iso(90) },
          { id: 14, type: "expire", resource_id: "role:coord-main", agent_id: "coord-main", payload: null, at: iso(1440) },
        ],
        generated_at: new Date(now).toISOString(),
      }),
    })
  );
  await registerAndGotoCoord(page);

  // 租约卡：三行租约 + 持有者
  const claims = page.getByTestId("coord-claims");
  await expect(claims).toBeVisible();
  await expect(claims.getByText("role:coord-main")).toBeVisible();
  await expect(claims.getByText("持有者 wrk-room-1")).toBeVisible();

  // 心跳状态点语义：<5min 新鲜 🟢 / <30min 渐旧 🟡 / ≥30min 陈旧 🔴
  await expect(claims.getByLabel("心跳新鲜")).toHaveCount(1);
  await expect(claims.getByLabel("心跳渐旧")).toHaveCount(1);
  await expect(claims.getByLabel("心跳陈旧")).toHaveCount(1);

  // 时间与 ttl 放 title 悬停（不占行内空间）
  const freshRow = claims.locator("li", { hasText: "role:coord-main" });
  await expect(freshRow).toHaveAttribute("title", /最后心跳 .+ · ttl 360m/);

  // 事件卡：expire → destructive；cycle-plan/andon → secondary；heartbeat → muted（低噪声）
  const events = page.getByTestId("coord-events");
  await expect(events).toBeVisible();
  await expect(events.locator(".bg-destructive", { hasText: "expire" })).toBeVisible();
  await expect(events.locator(".bg-secondary", { hasText: "cycle-plan" })).toBeVisible();
  await expect(events.locator(".bg-secondary", { hasText: "andon" })).toBeVisible();
  await expect(events.locator(".bg-muted", { hasText: "heartbeat" })).toBeVisible();

  // 不出现降级/未配置横幅
  await expect(page.getByTestId("card-unconfigured")).toHaveCount(0);
  await expect(page.getByTestId("card-degraded")).toHaveCount(0);
});

test("上游不可达（代理 502）：两卡显示 degraded 降级横幅，页面其余板块不受影响", async ({ page }) => {
  await page.route("**/api/portal/coordination", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "coord_service_unavailable" }) })
  );
  await registerAndGotoCoord(page);
  await expect(page.getByTestId("card-degraded")).toHaveCount(2);
  // shell 五 tab 仍在（互不拖垮）
  await expect(page.getByRole("button", { name: /讨论流/ })).toBeVisible();
});
