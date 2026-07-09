import { test, expect } from "@playwright/test";

// p23/F07 — 加入开发：onboarding 向导（现实版）+ 学习页。
// 契约要点：5 步 stepper（每步标预计耗时 + 所需条件，任意步可点击预览）；第 4 步显示审批 SLA；
// 第 5 步如实呈现人工发放三步流程 + export 命令模板（data-testid="credential-step"）；
// 提交申请按钮为诚实占位（disabled + 注明原因，真实提交待 ADR-011 P3）——绝不伪造提交成功。
// 界面契约 = p23 ui-signoff（confirmed 2026-07-09）。

const uniq = () => `p23f07_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function gotoJoinTab(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "Join", lastName: "Dev", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/portal");
  await page.getByRole("button", { name: /加入开发/ }).click();
  await expect(page.getByTestId("tab-join")).toBeVisible();
}

test("5 步 stepper：每步标预计耗时+所需条件，任意步可点击预览", async ({ page }) => {
  await gotoJoinTab(page);

  const stepper = page.getByTestId("onboarding-stepper");
  await expect(stepper).toBeVisible();
  for (const label of ["1. 登录", "2. 选角色", "3. 选模块", "4. 等审批", "5. 领凭据"]) {
    await expect(stepper.getByRole("button", { name: label })).toBeVisible();
  }

  // 默认第 1 步：时长 + 所需条件可见
  await expect(page.getByTestId("step-meta")).toContainText("本步预计 10 秒");
  await expect(page.getByTestId("step-meta")).toContainText("GitHub 账号");

  // 任意步可点击预览（直接跳第 4 步，不必顺序走）
  await stepper.getByRole("button", { name: "4. 等审批" }).click();
  await expect(page.getByTestId("step-meta")).toContainText("通常 < 1 个工作周期（3h）");

  // 回到第 2 步也行
  await stepper.getByRole("button", { name: "2. 选角色" }).click();
  await expect(page.getByRole("radiogroup", { name: "角色" })).toBeVisible();
});

test("第 4 步显示审批 SLA；第 3 步提交申请是诚实占位（disabled + 原因，不伪造成功）", async ({ page }) => {
  await gotoJoinTab(page);
  const stepper = page.getByTestId("onboarding-stepper");

  // 第 3 步：提交申请按钮 disabled 并注明原因（真实提交在 ADR-011 P3）
  await stepper.getByRole("button", { name: "3. 选模块" }).click();
  await expect(page.getByTestId("submit-application")).toBeDisabled();
  await expect(page.getByTestId("submit-disabled-reason")).toContainText("ADR-011 P3");

  // 第 4 步：审批 SLA
  await stepper.getByRole("button", { name: "4. 等审批" }).click();
  await expect(page.getByTestId("approval-sla")).toContainText("通常 < 1 个工作周期（3h）");
  await expect(page.getByText("coord-main 或仓库所有者")).toBeVisible();
});

test("第 5 步领凭据：人工发放三步流程 + export 命令模板 + 自动发放待 ADR-011 说明", async ({ page }) => {
  await gotoJoinTab(page);

  await page.getByTestId("onboarding-stepper").getByRole("button", { name: "5. 领凭据" }).click();
  const cred = page.getByTestId("credential-step");
  await expect(cred).toBeVisible();

  // 人工发放三步流程如实呈现
  await expect(cred).toContainText("mint token");
  await expect(cred).toContainText("coord-credentials.json");

  // export 命令模板
  const template = page.getByTestId("credential-export-template");
  await expect(template).toContainText("export COORD_SERVICE_URL=");
  await expect(template).toContainText("export COORD_SERVICE_TOKEN=");

  // 诚实注明：网页内一键发放待 ADR-011 P2/P3
  await expect(cred).toContainText("ADR-011 P2/P3");
});

test("学习页：4 条教程条目 + 注明渲染自 human-developer-onboarding.md", async ({ page }) => {
  await gotoJoinTab(page);

  const list = page.getByTestId("tutorial-list");
  await expect(list.locator("li")).toHaveCount(4);
  await expect(list).toContainText("开发模式一分钟图解");
  await expect(list).toContainText("module coordinator 的职责与派子 agent");
  await expect(list).toContainText("3 小时工作周期与流动时长");
  await expect(list).toContainText("防断链三原则");
  await expect(page.getByText(/human-developer-onboarding\.md/)).toBeVisible();
});
