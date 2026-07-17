import { test, expect, type Page } from "@playwright/test";

const uniq = () => `ava_settings_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page, email = uniq()) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  return email;
}

test("模型/Agent/工具选择在发送前生效，并由 stub 回复回显", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await expect(page.getByTestId("ai-settings")).toBeVisible();
  await expect(page.getByTestId("current-model")).toContainText("Stub Default");

  await page.getByTestId("model-select").selectOption("stub:planner");
  await page.getByTestId("agent-select").selectOption("research");
  // p18-F13 视觉改版（issue #465）：工具开关从 composer 平铺区移入「# Skill」pill 的
  // 弹出选单（对齐 prototype/oldcode 的 AIToolSelector 形态），点选前需先展开选单，
  // 选完再点一次 pill 收起。tool-* testid 本身不变。
  await page.getByTestId("composer-skill-trigger").click();
  await page.getByTestId("tool-board-context").click();
  await page.getByTestId("composer-skill-trigger").click();
  await expect(page.getByTestId("current-model")).toContainText("Stub Planner");
  await expect(page.getByTestId("current-agent")).toContainText("Research Agent");
  await expect(page.getByTestId("current-tools")).toContainText("Board Context");

  await page.getByTestId("composer").fill("用当前设置生成回复");
  await page.getByTestId("send").click();

  const assistant = page.getByTestId("msg-assistant");
  await expect(assistant).toContainText("模型：stub:planner", { timeout: 15_000 });
  await expect(assistant).toContainText("Agent：research");
  await expect(assistant).toContainText("工具：web-search, board-context");
  await expect(page.getByTestId("agent-select")).toBeDisabled();
  await expect(page.getByTestId("agent-locked")).toBeVisible();
});

test("普通团队成员不可选择 team-restricted 模型", async ({ page, playwright, baseURL }) => {
  const memberEmail = await register(page);

  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const team = await (await owner.post("/api/teams", { data: { name: "AVA Settings Team" } })).json();
  await owner.post("/api/teams/invite", { data: { teamId: team.team.id, email: memberEmail } });

  await page.request.post("/api/teams/current", { data: { teamId: team.team.id } });
  await page.goto("/ava");

  await expect(page.getByTestId("ai-settings")).toBeVisible();
  const restricted = page.getByTestId("model-select").locator("option[value='stub:team-pro']");
  await expect(restricted).toHaveAttribute("disabled", "");

  await owner.dispose();
});

test("受限模型被伪造提交时服务端回退默认模型", async ({ page, playwright, baseURL }) => {
  const memberEmail = await register(page);

  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const team = await (await owner.post("/api/teams", { data: { name: "AVA API Team" } })).json();
  await owner.post("/api/teams/invite", { data: { teamId: team.team.id, email: memberEmail } });

  await page.request.post("/api/teams/current", { data: { teamId: team.team.id } });
  const created = await page.request.post("/api/ava/threads");
  expect(created.status()).toBe(201);
  const { thread } = await created.json();

  const res = await page.request.post(`/api/ava/threads/${thread.id}/messages`, {
    data: {
      text: "伪造受限模型",
      modelId: "stub:team-pro",
      agentId: "research",
      toolIds: ["file-reader"],
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.text();
  expect(body).toContain("模型：stub:default");
  expect(body).not.toContain("DASHSCOPE_API_KEY");

  await owner.dispose();
});
