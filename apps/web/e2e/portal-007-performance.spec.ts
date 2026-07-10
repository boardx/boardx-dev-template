import { test, expect } from "@playwright/test";

// p23/F08 — 性能板块：按 开发者→agents 配对分组 + C-cycle 周期报告。
// 契约要点（人类补充需求 2026-07-09）：三层结构 👤 开发者分组头（人类，绝不作为 agent 行）
// → 🤖 agents 行 → sub-agent 按 parent 缩进（└）；owner（人类归属）与 parent（派生树）并存；
// flow-time/周期承诺无 per-agent 数据源 → "数据积累中"（诚实降级）；e2e 环境 COORD_SERVICE_URL
// 未配置 → 省略"当前租约"列；C-cycle 报告无 Web 数据源 → unconfigured 态提示接线中。
// 界面契约 = p23 ui-signoff（confirmed 2026-07-09）。数据源 = 本仓 .harness/agents/registry.yaml。

const uniq = () => `p23f08_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function gotoPerfTab(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Perf", lastName: "Dev", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: /性能/ }).click();
  await expect(page.getByTestId("tab-perf")).toBeVisible();
}

test("三层结构：👤 开发者分组头 → 🤖 agents 行 → sub-agent 按 parent 缩进（└）", async ({ page }) => {
  await gotoPerfTab(page);

  const groups = page.getByTestId("perf-dev-groups");
  await expect(groups).toBeVisible();

  // 开发者分组头：👤 + 合计 agent 数（registry 的 owner=usam.shen@gmail.com 组必然存在）
  const headers = page.getByTestId("perf-dev-header");
  expect(await headers.count()).toBeGreaterThan(0);
  await expect(headers.first()).toContainText("👤");
  await expect(headers.first()).toContainText("个 agent");

  // agent 行：🤖（registry 至少含 coord-main）
  await expect(groups.getByText("🤖 coord-main")).toBeVisible();

  // sub-agent 按 parent 缩进：registry 登记的 coord-architecture.portal-dev-* 带 └ 前缀
  await expect(groups.getByText(/└ 🤖 coord-architecture\.portal-dev-/).first()).toBeVisible();
});

test("开发者绝不作为 agent 行出现：分组头只有 👤，agent 行只有 🤖", async ({ page }) => {
  await gotoPerfTab(page);
  await expect(page.getByTestId("perf-dev-groups")).toBeVisible();

  // 每个分组头都是人类形态（👤），且不含 🤖
  const headers = page.getByTestId("perf-dev-header");
  const n = await headers.count();
  for (let i = 0; i < n; i++) {
    const text = (await headers.nth(i).textContent()) ?? "";
    expect(text).toContain("👤");
    expect(text).not.toContain("🤖");
  }

  // 反向：owner 邮箱（开发者标识）不出现在任何 🤖 行里
  const robotRows = page.getByTestId("perf-dev-groups").locator("tr").filter({ hasText: "🤖" });
  const robotCount = await robotRows.count();
  for (let i = 0; i < robotCount; i++) {
    expect((await robotRows.nth(i).textContent()) ?? "").not.toContain("👤");
  }
});

test("诚实降级：flow-time/周期承诺显示'数据积累中'；coord 未配置省略租约列；C-cycle 卡未接线", async ({ page }) => {
  await gotoPerfTab(page);
  await expect(page.getByTestId("perf-dev-groups")).toBeVisible();

  // per-agent flow-time / 周期承诺无数据源 → "数据积累中"，不显示编造数字
  await expect(page.getByText("数据积累中").first()).toBeVisible();

  // e2e 环境 COORD_SERVICE_URL 未配置 → 省略"当前租约"列 + 中间态说明
  await expect(page.getByRole("columnheader", { name: "当前租约" })).toHaveCount(0);
  await expect(page.getByText(/COORD_SERVICE_URL 未配置/)).toBeVisible();

  // C-cycle 周期报告：无 Web 数据源 → unconfigured 态提示接线中（不渲染假表）
  await expect(page.getByText(/cycle-report CLI 数据接线中/)).toBeVisible();
});
