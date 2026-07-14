import { test, expect, type Page } from "@playwright/test";

const uniq = () => `hqc_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Quick", lastName: "Chat", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function publishAndSubscribeAgent(page: Page, name: string) {
  const res = await page.request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "personal",
      action: "publish",
      name,
      description: "Quick chat target agent",
      tags: ["quick"],
      examples: [],
      config: { prompt: "test" },
    },
  });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).item.id as number;
  const sub = await page.request.post(`/api/ai-store/items/${id}/subscribe`, { data: { scope: "personal" } });
  expect(sub.ok()).toBeTruthy();
  return id;
}

// p2-F06：Agent 卡片「Quick chat」→ 创建线程（写线程名）并跳 AVA 打开该线程。
test("快捷对话：创建命名线程并跳转 AVA 打开", async ({ page }) => {
  await register(page);
  const name = `QC Agent ${Date.now()}`;
  const id = await publishAndSubscribeAgent(page, name);

  await page.goto("/home");
  await page.getByTestId(`quick-chat-${id}`).click();

  await expect(page).toHaveURL(new RegExp(`/ava\\?threadId=\\d+&agentItemId=${id}`));
  // 线程已按 agent 命名并被打开（thread-header 只在有活动线程时出现）。
  await expect(page.getByTestId("thread-header")).toBeVisible();
  await expect(page.getByTestId("thread-list")).toContainText(`Chat with ${name}`);
});

// p2-F06：欢迎区「继续上次对话」在有线程时出现，点击跳回该线程。
test("继续上次对话：有线程时出现并跳回", async ({ page }) => {
  await register(page);
  // 无线程时不显示。
  await page.goto("/home");
  await expect(page.getByTestId("home-welcome")).toBeVisible();
  await expect(page.getByTestId("continue-last-thread")).toHaveCount(0);

  // 造一个线程。
  const res = await page.request.post("/api/ava/threads");
  expect(res.ok()).toBeTruthy();
  const tid = (await res.json()).thread.id as number;

  await page.goto("/home");
  await page.getByTestId("continue-last-thread").click();
  await expect(page).toHaveURL(new RegExp(`/ava\\?threadId=${tid}`));
  await expect(page.getByTestId("thread-header")).toBeVisible();
});

// p2-F06：推荐功能启动器——用户研究/深度研究 创建对应 researchType 线程并跳转；
// 实时转录创建命名线程跳转。
test("推荐功能启动：用户研究进入 research 模式并选中类型", async ({ page }) => {
  await register(page);
  await page.goto("/home");
  await page.getByTestId("launch-user-research").click();

  await expect(page).toHaveURL(/mode=research&researchType=user-research/);
  // composer 研究模式 pill 处于按下态且显示所选类型。
  const pill = page.getByTestId("mode-research");
  await expect(pill).toHaveAttribute("aria-pressed", "true");
  await expect(pill).toContainText("用户研究");
  await expect(page.getByTestId("thread-list")).toContainText("用户研究");
});

test("推荐功能启动：深度研究 → market 类型；实时转录 → 命名线程", async ({ page }) => {
  await register(page);
  await page.goto("/home");
  await page.getByTestId("launch-deep-research").click();
  await expect(page).toHaveURL(/mode=research&researchType=market/);
  await expect(page.getByTestId("mode-research")).toContainText("深度研究");

  await page.goto("/home");
  await page.getByTestId("launch-transcription").click();
  await expect(page).toHaveURL(/\/ava\?threadId=\d+$/);
  await expect(page.getByTestId("thread-list")).toContainText("实时转录");
});

// p2-F06：创建失败停留 Home、可重试；创建中防重复点击（按钮 disabled）。
test("创建线程失败停留 Home 显示错误，可重试成功", async ({ page }) => {
  await register(page);
  await page.goto("/home");

  let fail = true;
  await page.route("**/api/ava/threads", async (route) => {
    if (route.request().method() === "POST" && fail) {
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("launch-deep-research").click();
  await expect(page.getByTestId("launch-error")).toBeVisible();
  await expect(page).toHaveURL(/\/home/);

  // 重试成功。
  fail = false;
  await page.getByTestId("launch-deep-research").click();
  await expect(page).toHaveURL(/mode=research&researchType=market/);
});
