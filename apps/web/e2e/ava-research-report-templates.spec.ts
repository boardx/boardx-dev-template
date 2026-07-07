import { test, expect } from "@playwright/test";

// P18 F05：研究报告双模板（market / user-research）。
//
// 覆盖点（对应 issue #421 的 user_visible_behavior）：
//  1. 市场类研究主题（不含 user-research 关键词）→ 报告面板展示 Executive summary /
//     Key findings / Recommendation 三个字段区块，且不展示 user-research 专属字段。
//  2. 用户研究类主题（含 "user research"/"persona"/"pain point" 等关键词）→ 报告面板
//     展示 Summary / Personas / Top pain points / Opportunities 四个字段区块，且不展示
//     market 专属字段。
//  3. 两类字段确实随内容变化（嵌入各自 topic 的关键词），不是同一套泛化模板硬套。
//
// 本 spec 全程走 stub: 模型（mock-provider 模式）：packages/ai/src/gateway.ts 的
// buildStubResearchJson 按 topic/audience 关键词确定性地派生 market 或 user-research
// 两套结构中的一套，供这里确定性地断言两套字段分别正确渲染。

const uniq = () => `ava_research_tpl_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "T", lastName: "P", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function runResearchToReport(page: import("@playwright/test").Page, topic: string) {
  await page.getByTestId("mode-research").click();
  await page.getByTestId("composer").fill(topic);
  await page.getByTestId("send").click();

  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft", {
    timeout: 15_000,
  });
  await page.getByTestId("confirm-research-clarify").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "clarified");
  await page.getByTestId("confirm-research-plan").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "running", {
    timeout: 15_000,
  });

  await expect(page.getByTestId("research-report-notice")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("open-report").click();
  await expect(page.getByTestId("research-report-panel")).toBeVisible();
}

test("市场类研究主题：报告面板展示 Executive summary / Key findings / Recommendation", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await runResearchToReport(
    page,
    "Pricing strategy for enterprise whiteboard market expansion"
  );

  await expect(page.getByTestId("research-report-panel")).toHaveAttribute(
    "data-report-type",
    "market"
  );
  await expect(page.getByTestId("report-summary-label")).toHaveText("Executive summary");
  await expect(page.getByTestId("report-key-findings")).toBeVisible();
  await expect(page.getByTestId("report-key-findings")).toContainText("Key findings");
  await expect(page.getByTestId("report-key-findings")).toContainText("pricing");
  await expect(page.getByTestId("report-recommendation")).toBeVisible();
  await expect(page.getByTestId("report-recommendation")).toContainText("Recommendation");

  // user-research 专属字段不应出现在市场类报告里。
  await expect(page.getByTestId("report-personas")).toHaveCount(0);
  await expect(page.getByTestId("report-top-pain-points")).toHaveCount(0);
  await expect(page.getByTestId("report-opportunities")).toHaveCount(0);
});

test("用户研究类主题：报告面板展示 Summary / Personas / Top pain points / Opportunities", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await runResearchToReport(
    page,
    "User research on onboarding friction for new workspace admins"
  );

  await expect(page.getByTestId("research-report-panel")).toHaveAttribute(
    "data-report-type",
    "user-research"
  );
  await expect(page.getByTestId("report-summary-label")).toHaveText("Summary");
  await expect(page.getByTestId("report-personas")).toBeVisible();
  await expect(page.getByTestId("report-personas")).toContainText("Personas");
  await expect(page.getByTestId("report-top-pain-points")).toBeVisible();
  await expect(page.getByTestId("report-top-pain-points")).toContainText("Top pain points");
  await expect(page.getByTestId("report-top-pain-points")).toContainText("user");
  await expect(page.getByTestId("report-opportunities")).toBeVisible();
  await expect(page.getByTestId("report-opportunities")).toContainText("Opportunities");

  // market 专属字段不应出现在用户研究类报告里。
  await expect(page.getByTestId("report-key-findings")).toHaveCount(0);
  await expect(page.getByTestId("report-recommendation")).toHaveCount(0);
});
