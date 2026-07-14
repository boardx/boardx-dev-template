import { test, expect, type Page } from "@playwright/test";

const uniq = () => `has_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Search", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

/** 通过 API 创建并发布一个 personal Agent，返回 id。 */
async function publishAgent(page: Page, name: string, description: string, tags: string[], scope = "personal") {
  const res = await page.request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope,
      action: "publish",
      name,
      description,
      tags,
      examples: [],
      config: { prompt: "test" },
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.item?.id ?? body.id;
}

// p2-F03：Home 顶部搜索框对已加载 Agent 按名称/描述/标签过滤，
// 分组只显示匹配卡片并更新计数；无匹配显示空状态；清空恢复全部。
test("搜索按名称/描述/标签过滤分组、更新计数、无匹配空态、清空恢复", async ({ page }) => {
  await register(page);
  // team-scope 发布需要一个当前团队（POST /api/teams 会同时设置当前团队 cookie）。
  const teamRes = await page.request.post("/api/teams", { data: { name: `Search Team ${Date.now()}` } });
  expect(teamRes.ok()).toBeTruthy();
  const suffix = Date.now();
  const nameA = `Alpha Writer ${suffix}`;
  const nameB = `Beta Coder ${suffix}`;
  const idA = await publishAgent(page, nameA, "Helps drafting documents", ["writing"]);
  await publishAgent(page, nameB, "Generates code snippets", ["coding"], "team");

  // 订阅 A → 出现在「My subscribed」；B 未订阅 → 留在「Team recommended」。
  const sub = await page.request.post(`/api/ai-store/items/${idA}/subscribe`, { data: { scope: "personal" } });
  expect(sub.ok()).toBeTruthy();

  await page.goto("/home");
  await expect(page.getByTestId("agent-search")).toBeVisible();

  // 初始：A 在 subscribed，B 在 recommended（A 被去重不出现在 recommended）。
  await expect(page.getByTestId("group-subscribed").getByTestId(`agent-${idA}`)).toBeVisible();
  await expect(page.getByTestId("group-count-subscribed")).toHaveText("(1)");
  await expect(page.getByTestId("group-recommended").locator(`[data-testid^="agent-"]`)).toHaveCount(1);
  await expect(page.getByTestId("group-recommended")).toContainText(nameB);

  // 按名称过滤：只留 A，recommended 无匹配显示空态，计数归零。
  await page.getByTestId("agent-search").fill("Alpha Writer");
  await expect(page.getByTestId("group-subscribed").getByTestId(`agent-${idA}`)).toBeVisible();
  await expect(page.getByTestId("group-count-subscribed")).toHaveText("(1)");
  await expect(page.getByTestId("no-match-recommended")).toBeVisible();
  await expect(page.getByTestId("group-count-recommended")).toHaveText("(0)");

  // 按描述过滤（大小写不敏感）：只留 B。
  await page.getByTestId("agent-search").fill("CODE SNIPPETS");
  await expect(page.getByTestId("no-match-subscribed")).toBeVisible();
  await expect(page.getByTestId("group-recommended")).toContainText(nameB);
  await expect(page.getByTestId("group-count-recommended")).toHaveText("(1)");

  // 按标签过滤：writing → 只留 A。
  await page.getByTestId("agent-search").fill("writing");
  await expect(page.getByTestId("group-subscribed").getByTestId(`agent-${idA}`)).toBeVisible();
  await expect(page.getByTestId("no-match-recommended")).toBeVisible();

  // 全不匹配：两个有数据的分组都显示无匹配空态。
  await page.getByTestId("agent-search").fill("zzz-nothing-matches");
  await expect(page.getByTestId("no-match-subscribed")).toBeVisible();
  await expect(page.getByTestId("no-match-recommended")).toBeVisible();

  // 无数据分组（recent）始终走原空状态，不受搜索影响。
  await expect(page.getByTestId("empty-recent")).toBeVisible();

  // 清空恢复全部。
  await page.getByTestId("agent-search").fill("");
  await expect(page.getByTestId("group-count-subscribed")).toHaveText("(1)");
  await expect(page.getByTestId("group-count-recommended")).toHaveText("(1)");
});

// 数据加载中显示占位骨架，返回后刷新出真实分组。
test("加载中显示占位，数据返回后渲染分组", async ({ page }) => {
  await register(page);
  await page.route("**/api/ai-store/items?subscribed=me", async (route) => {
    await new Promise((r) => setTimeout(r, 600));
    await route.continue();
  });
  await page.goto("/home");
  await expect(page.getByTestId("loading")).toBeVisible();
  await expect(page.getByTestId("group-subscribed")).toBeVisible();
  await expect(page.getByTestId("loading")).toHaveCount(0);
});
