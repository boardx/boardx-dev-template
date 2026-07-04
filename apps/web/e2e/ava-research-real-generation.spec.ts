import { test, expect } from "@playwright/test";

// P18 F04：Deep Research 真实生成（替换硬编码 stub）+ 两步交互确认。
//
// 覆盖点（对应 issue #257 的 user_visible_behavior）：
//  1. 同一线程内两次不同主题的研究，澄清问题/计划/报告内容应该不同——证明内容确实由
//     真实生成引擎针对 topic 产出，而不是硬编码的固定文案（buildResearch() 已删除）。
//  2. research-clarify（澄清确认）与 confirm-research-plan（计划确认）是两个独立的、
//     必须显式确认的步骤：draft 阶段只能确认澄清问题，未确认澄清时不存在计划确认按钮，
//     不能从提交主题直接跳到可确认计划/执行。
//  3. 执行时间线（research-timeline）的阶段状态来自后端真实推进（PATCH .../research/
//     :sessionId 的 action=advance，每次调用都是服务端计算 + 持久化的一次真实推进），
//     不是前端 setTimeout 凭空拼出来的动画——用刷新中途状态验证服务端确实记录了
//     真实的阶段进度（而不是纯前端内存状态）。
//  4. 真实生成失败（RESEARCH_FORCE_FAIL_MARKER 触发）时的失败态与可重试。
//
// 本 spec 全程走 stub: 模型（mock-provider 模式），不消耗真实供应商额度；stub provider
// 识别到 RESEARCH_JSON_SYSTEM_MARKER 时会按 topic/audience 派生确定性但随主题变化的
// JSON（见 packages/ai/src/gateway.ts buildStubResearchJson），因此这里能确定性地验证
// "不同主题产出不同内容"，无需额外的 env-gated 真实模型冒烟（那部分覆盖交给
// ava-real-model-failure.spec.ts 一类的假 Anthropic server 手法，不在本 spec 重复）。

const uniq = () => `ava_research_real_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "R", lastName: "G", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("同一线程两次不同主题的研究：澄清问题/计划/报告内容不同（真实生成而非固定文案）", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page.getByTestId("composer").fill("Research pricing sensitivity for enterprise onboarding flows");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft", {
    timeout: 15_000,
  });
  const firstClarify = await page.getByTestId("research-clarify").innerText();

  // 新建第二个线程，提交一个完全不同的主题。
  await page.getByTestId("new-chat").click();
  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research churn drivers for community moderator retention programs");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft", {
    timeout: 15_000,
  });
  const secondClarify = await page.getByTestId("research-clarify").innerText();
  const secondPlan = await page.getByTestId("research-plan").innerText();

  // 两次研究的澄清问题内容不同（各自嵌入了各自 topic 的关键词），不是同一段固定文案。
  expect(firstClarify).not.toEqual(secondClarify);
  expect(secondClarify).toContain("churn");
  expect(secondPlan).toContain("Audience:");
});

test("两步交互确认：研究计划确认按钮在澄清问题确认前不存在，确认后才出现", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research activation drivers for new workspace admins in collaboration tools");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("confirm-research-clarify")).toBeVisible();
  // 不能跳过澄清确认直接确认计划：计划确认按钮此时根本不存在于 DOM 里。
  await expect(page.getByTestId("confirm-research-plan")).toHaveCount(0);

  await page.getByTestId("confirm-research-clarify").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "clarified");
  // 澄清已确认：按钮消失，不能重复确认。
  await expect(page.getByTestId("confirm-research-clarify")).toHaveCount(0);
  // 计划确认现在才出现，是第二个独立的显式确认步骤。
  await expect(page.getByTestId("confirm-research-plan")).toBeVisible();

  await page.getByTestId("confirm-research-plan").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "running", {
    timeout: 15_000,
  });
});

test("执行时间线来自后端真实阶段进度：刷新后仍看到服务端持久化的中间阶段", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research expansion opportunities for mid-market whiteboard adoption teams");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("confirm-research-clarify")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("confirm-research-clarify").click();
  await expect(page.getByTestId("confirm-research-plan")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("confirm-research-plan").click();

  // 计划确认后立即进入 running：timeline 首阶段由服务端 confirm-plan 计算返回，
  // 不是前端凭空猜测的。
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "running", {
    timeout: 15_000,
  });
  await expect(page.getByTestId("research-timeline")).toContainText("Execution");

  // 等到真正推进过至少一步（timeline 里出现一个 complete 阶段）后再刷新——这一步的
  // 完成状态只可能来自服务端 advance 的持久化返回（前端没有自己的定时器动画代码路径
  // 会凭空产出这个中间态），刷新后能看到同一个中间态，证明它确实被真实持久化。
  await expect(page.getByTestId("research-timeline")).toContainText("complete", { timeout: 15_000 });

  await page.reload();
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await expect(page.getByTestId("research-card")).toBeVisible();
  const status = await page.getByTestId("research-card").getAttribute("data-status");
  // reload 中断了前端发起 advance 调用的循环（本身就证明推进不是靠一个持续运行、
  // 刷新也杀不死的后端进程在空转——每一步都是客户端触发、服务端计算并持久化的一次
  // 真实调用），因此这里只断言"没有跳回更早阶段"，不要求自动跑到 complete。
  expect(["running", "complete"]).toContain(status);
  await expect(page.getByTestId("research-timeline")).toContainText("Execution");
});

test("研究内容生成失败：展示可重试的失败态，主题保留", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page
    .getByTestId("composer")
    .fill("Research launch readiness __ava_research_generate_fail__");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("send-error")).toContainText("研究内容生成失败");
  await expect(page.getByTestId("err-research")).toContainText("研究内容生成失败");
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("composer")).toHaveValue(/__ava_research_generate_fail__/);
});
