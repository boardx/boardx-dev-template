import { test, expect } from "@playwright/test";

// p23/F03 — 脉搏与进度：总进度 N/M、phase 进度条、点击下钻（状态计数徽章）、
// flow-time 卡（中位值 + 基线对比）与诚实降级（github 未配置 → unconfigured 态）。
// 界面契约 = p23 ui-signoff（confirmed 2026-07-09）v3 原型 PulseTab。

const uniq = () => `p23f03_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndGotoPortal(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Pulse", lastName: "Dev", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
}

test("真实 pulse 数据：总进度 + phase 进度条可见，点击 phase 展开下钻（通过/未通过 状态计数）", async ({ page }) => {
  await registerAndGotoPortal(page);

  // phases 源来自本仓 feature_list.json 本地聚合——永远可用，无需外部配置
  const bars = page.getByTestId("phase-bars");
  await expect(bars).toBeVisible();
  await expect(page.getByText(/项通过/)).toBeVisible();

  // 点击第一个 phase → 下钻展开，带语义色状态徽章
  const firstBar = bars.getByRole("button").first();
  await firstBar.click();
  const drill = page.getByTestId("phase-drill");
  await expect(drill).toBeVisible();
  await expect(drill).toContainText("通过");
  await expect(drill).toContainText("未通过");

  // 再次点击同一 phase → 下钻收起
  await firstBar.click();
  await expect(drill).toHaveCount(0);
});

test("诚实降级：e2e 环境 GITHUB_TOKEN 未配置 → flow-time 卡走 unconfigured 态而非虚构数据", async ({ page }) => {
  await registerAndGotoPortal(page);
  await expect(page.getByTestId("phase-bars")).toBeVisible();
  // flow-time 卡的数据源未接线 → PortalCard unconfigured（部署中间态提示，非红色故障）
  await expect(page.getByTestId("card-unconfigured").first()).toBeVisible();
  await expect(page.getByTestId("flow-time")).toHaveCount(0);
});

test("github 已配置（mock pulse API）：flow-time 卡显示中位值与基线 1.8h 对比", async ({ page }) => {
  await page.route("**/api/portal/pulse", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        phases: {
          items: [
            { id: "p23", name: "developer-portal", passing: 2, total: 8 },
            { id: "p18", name: "ava-ai-realization", passing: 13, total: 13 },
          ],
          totals: { passing: 15, total: 21 },
        },
        coord: { configured: false },
        github: { configured: true, merged_last_24h: 6, flow_hours_median: 0.9 },
        generated_at: new Date().toISOString(),
      }),
    })
  );
  await registerAndGotoPortal(page);

  await expect(page.getByTestId("totals-passing")).toHaveText("15");
  const flow = page.getByTestId("flow-time");
  await expect(flow).toBeVisible();
  await expect(flow).toContainText("0.9h");
  await expect(flow).toContainText("基线 1.8h ↓50%"); // 0.9 vs 1.8 → ↓50%
  await expect(flow).toContainText("近 24h 合并 6 个 PR");

  // 下钻在 mock 数据上同样工作：p23 → 通过 2 / 未通过 6
  await page.getByRole("button", { name: /p23 · developer-portal/ }).click();
  const drill = page.getByTestId("phase-drill");
  await expect(drill).toContainText("通过 2");
  await expect(drill).toContainText("未通过 6");
});
