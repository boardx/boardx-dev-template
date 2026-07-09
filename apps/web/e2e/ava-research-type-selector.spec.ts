import { test, expect } from "@playwright/test";

// P18-F14：研究类型显式选单（oldcode ResearchTypeSelector 迁移，issue #514）。
//
// composer 的「✦ Deep Research」pill 从单一开关升级为弹出式研究类型选单（形态同 F13
// skill menu：名称 + 描述 + 选中勾），提供 深度研究（→ market 模板）/ 用户研究
// （→ user-research 模板）两个显式选项。覆盖点：
//  1. 选单展示两种类型（名称 + 描述 + 当前选中勾），pill 显示当前激活类型，可切换/退出。
//  2. 显式类型胜过关键词推断：中性主题（不含 user-research 关键词）+ 显式选 用户研究
//     → user-research 模板；含 user-research 关键词的主题 + 显式选 深度研究 → market 模板。
//  3. 刷新恢复（F03 持久化）后类型保持：报告模板不变，pill 恢复所选类型。
//  4. 无显式类型时 inferResearchType 关键词兜底仍在（历史会话/老客户端兼容，API 级验证）。
//  5. 顺带修复回归锚点：composer textarea 聚焦不再出现浏览器默认 outline（橙色 auto ring）。
//
// 全程走 stub: 模型（mock-provider 模式）：gateway.ts 的 buildStubResearchJson 优先读
// researchGenerator 下发的显式 "Research type:" 行，无显式类型时才按 topic 关键词嗅探。

const uniq = () => `ava_research_type_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "T", lastName: "S", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

/** 已进入研究模式、类型已选定的前提下：提交主题并两步确认走到报告面板。 */
async function submitTopicToReport(page: import("@playwright/test").Page, topic: string) {
  await page.getByTestId("composer").fill(topic);
  await page.getByTestId("send").click();

  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "draft", {
    timeout: 15_000,
  });
  await page.getByTestId("confirm-research-clarify").click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "clarified", {
    timeout: 15_000,
  });
  await page.getByTestId("confirm-research-plan").click();
  await expect(page.getByTestId("research-report-notice")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("open-report").click();
  await expect(page.getByTestId("research-report-panel")).toBeVisible();
}

test("类型选单：两种类型带名称/描述/选中勾，pill 显示激活类型，可切换与退出", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  // 进入研究模式时选单自动弹出（可发现性：用户第一次就能看到两种类型可选）。
  await page.getByTestId("mode-research").click();
  const menu = page.getByTestId("research-type-menu");
  await expect(menu).toBeVisible();

  // 两个选项：名称 + 描述都可见（oldcode ResearchTypeSelector 的选单形态）。
  await expect(menu.getByTestId("research-type-market")).toContainText("深度研究");
  await expect(menu.getByTestId("research-type-market")).toContainText("Executive summary");
  await expect(menu.getByTestId("research-type-user-research")).toContainText("用户研究");
  await expect(menu.getByTestId("research-type-user-research")).toContainText("Personas");

  // 默认激活 深度研究：选中勾落在 market 项上，pill 文案为「深度研究」。
  await expect(menu.getByTestId("research-type-market")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mode-research")).toContainText("深度研究");

  // 切换到 用户研究：选单关闭，pill 显示「用户研究」。
  await menu.getByTestId("research-type-user-research").click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByTestId("mode-research")).toContainText("用户研究");

  // 再次点击 pill 重新打开选单：选中勾已移到 用户研究。
  await page.getByTestId("mode-research").click();
  await expect(page.getByTestId("research-type-user-research")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByTestId("research-type-market")).toHaveAttribute("aria-pressed", "false");

  // ✕ 退出研究模式：回到普通聊天（placeholder 复原，pill 回到通用文案）。
  await page.getByTestId("mode-chat").click();
  await expect(page.getByTestId("research-type-menu")).toHaveCount(0);
  await expect(page.getByTestId("composer")).toHaveAttribute("placeholder", "Message AVA…");
  await expect(page.getByTestId("mode-research")).toContainText("Deep Research");
  await expect(page.getByTestId("mode-chat")).toHaveCount(0);
});

test("显式选 用户研究 + 中性主题 → user-research 模板（显式类型胜过关键词推断）+ 刷新后类型保持", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page.getByTestId("research-type-user-research").click();

  // 中性主题：不含任何 user-research 关键词（"pricing/market" 词面按关键词推断只会
  // 判成 market）——报告仍按 user-research 渲染，证明显式选择在驱动模板，而不是推断。
  await submitTopicToReport(page, "Pricing strategy for enterprise whiteboard market expansion");

  await expect(page.getByTestId("research-report-panel")).toHaveAttribute(
    "data-report-type",
    "user-research"
  );
  await expect(page.getByTestId("report-summary-label")).toHaveText("Summary");
  await expect(page.getByTestId("report-personas")).toBeVisible();
  await expect(page.getByTestId("report-key-findings")).toHaveCount(0);

  // 刷新恢复（F03 持久化）：报告模板类型保持 user-research，pill 恢复所选类型。
  await page.reload();
  await page.getByTestId("thread-list").getByRole("button").first().click();
  await expect(page.getByTestId("research-card")).toHaveAttribute("data-status", "complete", {
    timeout: 15_000,
  });
  await page.getByTestId("open-report").click();
  await expect(page.getByTestId("research-report-panel")).toHaveAttribute(
    "data-report-type",
    "user-research"
  );
  // 重新进入研究模式：类型选中态从持久化会话恢复（不是跳回默认 深度研究）。
  await page.getByTestId("mode-research").click();
  await expect(page.getByTestId("mode-research")).toContainText("用户研究");
  await expect(page.getByTestId("research-type-user-research")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
});

test("显式选 深度研究 + 含用户研究关键词的主题 → market 模板（显式类型胜过关键词推断）", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("mode-research").click();
  await page.getByTestId("research-type-market").click();

  // 主题刻意包含 "user research"/"persona" 关键词：按推断会判成 user-research，
  // 显式选择的 深度研究（market）必须获胜。
  await submitTopicToReport(
    page,
    "User research persona tooling vendors compared for procurement decision"
  );

  await expect(page.getByTestId("research-report-panel")).toHaveAttribute(
    "data-report-type",
    "market"
  );
  await expect(page.getByTestId("report-summary-label")).toHaveText("Executive summary");
  await expect(page.getByTestId("report-key-findings")).toBeVisible();
  await expect(page.getByTestId("report-personas")).toHaveCount(0);
});

test("无显式类型时关键词兜底仍在（历史会话/老客户端兼容，API 级）", async ({ page }) => {
  await register(page);

  // 老客户端形态：POST /research 不带 researchType 字段 → inferResearchType 按
  // topic 关键词兜底（含 "user research" → user-research 模板）。
  const threadRes = await page.request.post("/api/ava/threads");
  expect(threadRes.ok()).toBeTruthy();
  const { thread } = await threadRes.json();

  const res = await page.request.post(`/api/ava/threads/${thread.id}/research`, {
    data: {
      topic: "User research on onboarding friction for new workspace admins",
      modelId: "stub:default",
    },
  });
  expect(res.status()).toBe(201);
  const data = await res.json();
  expect(data.research.report.researchType).toBe("user-research");

  // 反向：无显式类型 + 中性主题 → market。
  const res2 = await page.request.post(`/api/ava/threads/${thread.id}/research`, {
    data: {
      topic: "Pricing strategy for enterprise whiteboard market expansion",
      modelId: "stub:default",
    },
  });
  expect(res2.status()).toBe(201);
  const data2 = await res2.json();
  expect(data2.research.report.researchType).toBe("market");
});

test("composer 聚焦样式：不再是浏览器默认 outline（橙色 auto ring）", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  const outline = await page.getByTestId("composer").evaluate((el) => {
    (el as HTMLTextAreaElement).focus();
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor };
  });
  // 浏览器默认聚焦轮廓是 outline-style: auto（Chrome 下呈橙/蓝色系统色）。设计系统口径
  // （components/ui/textarea.tsx 同款 focus-visible:outline-none）下 outline 要么为 none，
  // 要么是 Tailwind 重置的透明描边（2px solid transparent）——两者都不是 auto。
  expect(outline.style).not.toBe("auto");
  if (outline.style !== "none" && outline.width !== "0px") {
    // 仍渲染 outline 时必须是全透明（Tailwind outline-none 的重置形态），不能有可见颜色。
    expect(outline.color).toMatch(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/);
  }
});
