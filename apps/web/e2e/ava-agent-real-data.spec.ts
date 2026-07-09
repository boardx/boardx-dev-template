// e2e/ava-agent-real-data.spec.ts — p18-F09：Agent 选择器接入 AI Store 真实订阅数据。
//
// 验收口径（issue #259）：
//  1. 无订阅时 agent-select 仍提供内置默认 Agent（Default AVA / Research Agent）。
//  2. 在 AI Store 订阅一个 Agent 后刷新 /ava，选择器出现该 Agent（选项来自真实订阅，
//     非硬编码 AVA_AGENT_OPTIONS）；订阅的非 agent 类型（如 template）不进入选择器。
//  3. 选中订阅 Agent 发消息后，线程保持 agent-locked 禁用态（既有锁定行为不回归）。
import { test, expect, type Page } from "@playwright/test";

const uniq = () => `ava_agent_rd_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  const email = uniq();
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "Agent", lastName: "Data", email, password: "secret123", agreeTerms: true },
  });
  expect(res.status(), "注册应成功").toBeLessThan(400);
  return email;
}

/** 通过 API 创建并发布一个 personal 范围的 AI Store 项目，返回 item id（复用 p11-F02 创建端点）。 */
async function publishItem(page: Page, type: "agent" | "template", name: string): Promise<number> {
  const res = await page.request.post("/api/ai-store/items", {
    data: {
      type,
      action: "publish",
      scope: "personal",
      name,
      description: `E2E ${type} for real agent-select data.`,
      config: "Answer questions for the F09 spec.",
    },
  });
  expect(res.status(), "创建并发布项目应返回 201").toBe(201);
  const data = await res.json();
  return Number(data.item.id);
}

/** 订阅一个已发布项目（复用 p11-F03 订阅端点）。 */
async function subscribeItem(page: Page, itemId: number) {
  const res = await page.request.post(`/api/ai-store/items/${itemId}/subscribe`, {
    data: { scope: "personal" },
  });
  expect(res.status(), "订阅应返回 201").toBe(201);
}

test("无订阅时 agent-select 只有内置默认 Agent", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await expect(page.getByTestId("agent-select")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("agent-select").locator("option")).toHaveText(
    ["Default AVA", "Research Agent"],
    { timeout: 15_000 }
  );
});

test("订阅 Agent 后刷新 /ava 出现在选择器中，可选中发送；template 订阅不进入选择器", async ({
  page,
}) => {
  await register(page);
  const suffix = Date.now();
  const agentName = `Real Store Agent ${suffix}`;
  const templateName = `Real Store Template ${suffix}`;

  const agentItemId = await publishItem(page, "agent", agentName);
  const templateItemId = await publishItem(page, "template", templateName);

  // 订阅前：/ava 的 agent-select 不包含该 Agent（选项来自真实订阅数据，而非全部项目）。
  await page.goto("/ava");
  await expect(page.getByTestId("agent-select")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("agent-select").locator("option")).toHaveText(
    ["Default AVA", "Research Agent"],
    { timeout: 15_000 }
  );

  // 订阅 agent + template 两个项目后刷新：只有 agent 类型进入选择器。
  await subscribeItem(page, agentItemId);
  await subscribeItem(page, templateItemId);
  await page.reload();

  const agentSelect = page.getByTestId("agent-select");
  await expect(agentSelect).toBeVisible({ timeout: 15_000 });
  await expect(agentSelect.locator(`option[value="store-${agentItemId}"]`)).toHaveText(agentName, {
    timeout: 15_000,
  });
  await expect(agentSelect.locator("option")).toHaveText(
    ["Default AVA", "Research Agent", agentName],
    { timeout: 15_000 }
  );
  await expect(agentSelect.locator(`option[value="store-${templateItemId}"]`)).toHaveCount(0);

  // 选中订阅的 Agent 发消息：stub 回复回显该 agentId，证明设置端到端生效（未被归一化回默认）。
  await agentSelect.selectOption(`store-${agentItemId}`);
  await expect(page.getByTestId("current-agent")).toContainText(agentName);
  await page.getByTestId("composer").fill("用订阅的 Agent 生成回复");
  await page.getByTestId("send").click();
  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toContainText(`Agent：store-${agentItemId}`, { timeout: 15_000 });

  // 已有消息的线程保持 agent-locked 禁用态（既有行为不回归）。
  await expect(agentSelect).toBeDisabled();
  await expect(page.getByTestId("agent-locked")).toBeVisible();
});

test("取消订阅后刷新 /ava，该 Agent 从选择器移除，内置默认仍在", async ({ page }) => {
  await register(page);
  const agentName = `Unsub Agent ${Date.now()}`;
  const itemId = await publishItem(page, "agent", agentName);
  await subscribeItem(page, itemId);

  await page.goto("/ava");
  const agentSelect = page.getByTestId("agent-select");
  await expect(agentSelect.locator(`option[value="store-${itemId}"]`)).toHaveText(agentName, {
    timeout: 15_000,
  });

  const res = await page.request.delete(`/api/ai-store/items/${itemId}/subscribe`);
  expect(res.status(), "取消订阅应成功").toBe(200);
  await page.reload();

  await expect(agentSelect).toBeVisible({ timeout: 15_000 });
  await expect(agentSelect.locator("option")).toHaveText(["Default AVA", "Research Agent"], {
    timeout: 15_000,
  });
});
