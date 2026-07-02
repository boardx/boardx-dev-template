import { test, expect } from "@playwright/test";

const uniq = () => `ava_research_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ava", lastName: "Research", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("Deep Research：提交主题 → 澄清/计划 → 确认执行时间线 → 报告面板 → 继续追问", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research adoption barriers for collaborative whiteboards in enterprise product teams");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("research-card")).toBeVisible();
  await expect(page.getByTestId("research-clarify")).toContainText("What decision");
  await expect(page.getByTestId("research-plan")).toContainText("Product leaders");
  await expect(page.getByTestId("confirm-research-plan")).toBeVisible();

  await page.getByTestId("confirm-research-plan").click();
  await expect(page.getByTestId("research-timeline")).toContainText("Execution");
  await expect(page.getByTestId("research-report-notice")).toBeVisible({ timeout: 10_000 });

  await page.getByTestId("open-report").click();
  await expect(page.getByTestId("research-report-panel")).toBeVisible();
  await expect(page.getByTestId("report-conclusion")).toContainText("strongest opportunity");

  await page.getByTestId("mode-chat").click();
  await page.getByTestId("composer").fill("What should we validate first?");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-user").last()).toContainText("What should we validate first?");
  await expect(page.getByTestId("msg-assistant").last()).toBeVisible({ timeout: 15_000 });
});

test("Deep Research：主题过短时展示错误并保留可恢复输入", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page.getByTestId("composer").fill("too");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("send-error")).toContainText("研究主题太短");
  await expect(page.getByTestId("err-research")).toContainText("研究主题太短");
  await expect(page.getByTestId("composer")).toHaveValue("too");
});

test("Deep Research：额度不足时展示提示并保留主题", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Investigate expansion market signals __ava_research_no_credits__");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("send-error")).toContainText("Credit 额度不足");
  await expect(page.getByTestId("err-research")).toContainText("Credit 额度不足");
  await expect(page.getByTestId("composer")).toHaveValue(/__ava_research_no_credits__/);
});

test("Deep Research：启动失败时展示可重试错误态", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page.getByTestId("composer").fill("Investigate launch readiness __ava_research_fail__");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("send-error")).toContainText("研究任务启动失败");
  await expect(page.getByTestId("err-research")).toContainText("研究任务启动失败");
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "error");
});
