import { test, expect } from "@playwright/test";

// P18-F03: Deep Research 持久化实体 + 刷新恢复。
// 此前 researchRun 完全是前端内存 state（setResearchRun），刷新页面即丢失，用户必须
// 从头开始。本 spec 验证 ava_research_sessions 落库 + GET 恢复：draft/running/complete
// 三个阶段各自刷新后 research-card 都能恢复到中断前的正确阶段与内容，而不是消失或
// 从头开始。与 e2e/ava-deep-research.spec.ts（F06 契约：完整正向流程一次走完）并存，
// 本 spec 专注"刷新恢复"这个新增维度。

const uniq = () => `ava_research_persist_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "P", lastName: "R", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

/** 刷新后重新打开第一个线程（与仓库既有 reload 恢复用例同一手法：thread-list 里点第一项）。 */
async function reopenFirstThread(page: import("@playwright/test").Page) {
  await page.reload();
  await page.getByTestId("thread-list").getByRole("button").first().click();
}

test("draft 阶段刷新：research-card 恢复澄清问题与计划内容", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research onboarding drop-off for new team admins in collaborative whiteboard products");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft");
  await expect(page.getByTestId("research-clarify")).toContainText("What decision");

  await reopenFirstThread(page);

  await expect(page.getByTestId("research-card")).toBeVisible();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft");
  await expect(page.getByTestId("research-clarify")).toContainText("What decision");
  await expect(page.getByTestId("research-plan")).toContainText("Audience:");
  // draft 阶段可继续确认计划（恢复的不是死态展示，而是可交互的同一份状态）
  await expect(page.getByTestId("confirm-research-plan")).toBeVisible();
});

test("running 阶段刷新：确认计划后立即刷新，research-card 恢复到 running 而非跳回 draft", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research pricing sensitivity for mid-market teams adopting collaborative whiteboards");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("confirm-research-plan")).toBeVisible();

  // 确认计划：状态机在服务端同步写为 running（persistResearchProgress 在 setTimeout
  // 动画启动前同步触发），紧接着立刻刷新——若恢复逻辑有问题，最容易在这里退化回 draft。
  await page.getByTestId("confirm-research-plan").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "running");

  await reopenFirstThread(page);

  await expect(page.getByTestId("research-card")).toBeVisible();
  const status = await page.getByTestId("research-card").getAttribute("data-status");
  // 动画节奏 350ms/阶段，reload 期间可能已推进；只断言"未跳回 draft、也不是消失"，
  // 即恢复到了 running 或更靠后的 complete（两者都代表状态被真实持久化并推进，而不是丢失）。
  expect(["running", "complete"]).toContain(status);
  await expect(page.getByTestId("research-timeline")).toContainText("Execution");
});

test("complete 阶段刷新：research-card 恢复为 complete，报告仍可打开", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research retention drivers for teams that adopt collaborative whiteboard tools long term");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("confirm-research-plan")).toBeVisible();

  await page.getByTestId("confirm-research-plan").click();
  await expect(page.getByTestId("research-report-notice")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "complete");

  await reopenFirstThread(page);

  await expect(page.getByTestId("research-card")).toBeVisible();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "complete");
  await expect(page.getByTestId("research-report-notice")).toBeVisible();

  await page.getByTestId("open-report").click();
  await expect(page.getByTestId("research-report-panel")).toBeVisible();
  await expect(page.getByTestId("report-conclusion")).toContainText("strongest opportunity");
});

test("未发起过研究的线程刷新：不出现 research-card（无会话时不误报）", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("composer").fill("普通聊天，不涉及 Deep Research");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("research-card")).toHaveCount(0);

  await reopenFirstThread(page);
  await expect(page.getByTestId("research-card")).toHaveCount(0);
});
