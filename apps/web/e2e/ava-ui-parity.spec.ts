// ava-ui-parity.spec.ts — p18-F13（issue #465）：/ava 界面对齐 prototype/oldcode 的
// 结构锚点断言。只断言信息架构与关键控件位置（视觉迁移的可回归骨架），
// 功能行为本身由既有 15 个 ava spec 回归。
import { test, expect, type Page } from "@playwright/test";

const uniq = () => `ava_parity_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ava", lastName: "Parity", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("侧栏：黑色 New chat 主按钮 + 日期分组线程列表（Today 分组头可见）", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await expect(page.getByTestId("new-chat")).toBeVisible();

  // 发一条消息创建线程 → 线程落在 Today 分组，分组头可见
  await page.getByTestId("composer").fill("Parity check: sidebar grouping");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });

  const todayGroup = page.getByTestId("thread-group-today");
  await expect(todayGroup).toBeVisible();
  await expect(todayGroup.locator("h2")).toHaveText("Today");
});

test("线程头部：Agent 头像/副标题 + 模型 pill + Share；Model 不再平铺在 composer 区", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  const header = page.getByTestId("thread-header");
  await expect(header).toBeVisible();
  // 副标题：agent 名称 · 角色
  await expect(header.getByTestId("thread-header-agent")).toContainText("· Agent");
  // 模型选择器是头部右上的 pill（内部仍是可 selectOption 的原生 select）
  const modelPill = header.getByTestId("thread-header-model-pill");
  await expect(modelPill).toBeVisible();
  await expect(modelPill.getByTestId("model-select")).toBeVisible();
  await expect(header.getByTestId("ava-share")).toBeVisible();
  // 反向锚点：composer 区不再平铺 Model 裸下拉
  await expect(page.getByTestId("composer-dropzone").getByTestId("model-select")).toHaveCount(0);
});

test("composer：底部一行 @ Expert / # Skill / ✦ Deep Research pill + 圆形发送按钮；Skill 弹出选单", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  const dropzone = page.getByTestId("composer-dropzone");
  await expect(page.getByTestId("composer")).toHaveAttribute("placeholder", "Message AVA…");

  // 底部一行（ai-settings 区）：附件/语音 + 三个 pill 入口 + 发送按钮都在 composer 容器内
  const bottomRow = dropzone.getByTestId("ai-settings");
  await expect(bottomRow).toBeVisible();
  await expect(bottomRow.getByTestId("attachment-trigger")).toBeVisible();
  await expect(bottomRow.getByTestId("voice-input-trigger")).toBeVisible();
  await expect(bottomRow.getByTestId("composer-agent-pill")).toBeVisible();
  await expect(bottomRow.getByTestId("composer-agent-pill").getByTestId("agent-select")).toBeVisible();
  await expect(bottomRow.getByTestId("composer-skill-trigger")).toBeVisible();
  await expect(bottomRow.getByTestId("composer-deep-research-pill")).toBeVisible();
  await expect(bottomRow.getByTestId("send")).toBeVisible();

  // Chat/Deep Research 不再是 composer 顶部 tab：Deep Research pill 切换研究模式
  await bottomRow.getByTestId("mode-research").click();
  await expect(page.getByTestId("composer")).toHaveAttribute(
    "placeholder",
    "Describe the research topic, audience, and decision…"
  );
  await page.getByTestId("mode-chat").click();
  await expect(page.getByTestId("composer")).toHaveAttribute("placeholder", "Message AVA…");

  // Skill pill 弹出选单（oldcode AIToolSelector 形态：名称 + 描述 + 选中勾）
  await bottomRow.getByTestId("composer-skill-trigger").click();
  const skillMenu = page.getByTestId("composer-skill-menu");
  await expect(skillMenu).toBeVisible();
  await expect(skillMenu.getByTestId("tool-web-search")).toBeVisible();
  await bottomRow.getByTestId("composer-skill-trigger").click();
  await expect(skillMenu).toHaveCount(0);
});

test("消息区：用户消息右对齐灰气泡（hover 出 Edit/Delete）、AI 消息左侧头像 + 内联文本操作行", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("composer").fill("Parity check: message alignment");
  await page.getByTestId("send").click();
  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toBeVisible({ timeout: 15_000 });

  // 对齐锚点：用户消息 end（右对齐），AI 消息 start（左对齐）
  const user = page.getByTestId("msg-user");
  await expect(user).toHaveAttribute("data-align", "end");
  await expect(assistant).toHaveAttribute("data-align", "start");

  // 用户消息 footer：默认隐藏（opacity 0），hover 后浮现 Edit/Delete
  const userActions = page.getByTestId("msg-user-actions");
  await expect(userActions).toHaveCSS("opacity", "0");
  await user.hover();
  await expect(userActions).toHaveCSS("opacity", "1");
  await expect(userActions.getByTestId("msg-edit")).toBeVisible();
  await expect(userActions.getByTestId("msg-delete")).toBeVisible();

  // AI 消息下方内联文本操作行（Copy / 👍 / 👎 / Regenerate / Send to board / Email）
  const actions = assistant.locator('[data-testid^="msg-actions-"]');
  await expect(actions).toBeVisible();
  await expect(actions.getByTestId("msg-copy")).toContainText("Copy");
  await expect(actions.getByTestId("msg-regenerate")).toContainText("Regenerate");
  await expect(actions.getByTestId("msg-send-to-board")).toContainText("Send to board");
  await expect(actions.getByTestId("msg-feedback-up")).toBeVisible();
  await expect(actions.getByTestId("msg-feedback-down")).toBeVisible();
});
