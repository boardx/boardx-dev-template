import { test, expect } from "@playwright/test";

// p23/F01 — Developer Portal 骨架：访客分流带、登录后五 tab、开发者身份 chip、
// 待拍板全局通知的诚实降级（discussions 数据源未配置 → 通知条与红点隐藏，不虚构）。
// 界面契约 = p23 ui-signoff（confirmed 2026-07-09）。

const uniq = () => `p23f01_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("未登录访问 /portal：访客分流带 + 登录入口，不暴露板块内容", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/portal");
  await expect(page.getByTestId("visitor-band")).toBeVisible();
  await expect(page.getByRole("link", { name: "登录", exact: true })).toBeVisible();
  await expect(page.getByTestId("dev-identity-chip")).toHaveCount(0);
});

test("登录后 /portal：五 tab 骨架 + 开发者身份 chip（👤 姓名 + 带来 N 个 agent）", async ({ page }) => {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Portal", lastName: "Dev", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");

  // 开发者身份 chip：人类形态（👤 + 姓名 + agent 配对计数）
  const chip = page.getByTestId("dev-identity-chip");
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Portal Dev");
  await expect(chip).toContainText("个 agent");

  // 五 tab 都在且可切换
  for (const label of ["脉搏与进度", "实时协调", "讨论流", "加入开发", "性能"]) {
    await expect(page.getByRole("button", { name: new RegExp(label) })).toBeVisible();
  }
  await page.getByRole("button", { name: /讨论流/ }).click();
  await expect(page.getByTestId("tab-talk")).toBeVisible();

  // 待拍板通知的诚实降级：e2e 环境 discussions 未配置（无 GITHUB_TOKEN）→
  // 通知条与红点必须隐藏（绝不虚构决策数）
  await expect(page.getByTestId("decide-banner")).toHaveCount(0);
});
