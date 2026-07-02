import { test, expect } from "@playwright/test";

// uc-survey-001-create-survey — 创建问卷（创建器 + 多题型 + 选项 + 预览）。
// surveys / survey_questions / survey_responses 落库（team 作用域地基，P13 F01）。

const uniq = () => `sv_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("已登录访问 /surveys 显示列表与空状态", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await expect(page.getByRole("heading", { name: "Surveys" })).toBeVisible();
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("创建问卷（private）后出现在列表", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("empty-new-survey").click();

  await page.getByTestId("survey-title").fill("Team Pulse Survey");
  await page.getByTestId("survey-desc").fill("Quick weekly check-in");
  await page.getByTestId("question-title-0").fill("How are you feeling this week?");

  // 增加一道题再删除，验证题目增删可用
  await page.getByTestId("add-question").click();
  await page.getByTestId("question-title-1").fill("Anything blocking you?");
  await page.getByTestId("question-delete-1").click();

  await page.getByTestId("save-survey").click();

  // 创建成功后得到可分享的问卷链接
  await expect(page.getByTestId("survey-created")).toBeVisible();
  await expect(page.getByTestId("survey-share-link")).toContainText("/survey/");
  await page.getByTestId("done-created").click();

  await expect(page.getByTestId("survey-list")).toContainText("Team Pulse Survey");
  await expect(page.getByTestId("survey-list")).toContainText("Private");
});

test("多题型 + 选项 + 排序 + 预览答题页", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("empty-new-survey").click();

  await page.getByTestId("survey-title").fill("Multi-type Survey");
  await page.getByTestId("question-title-0").fill("Pick one");
  await page.getByTestId("question-type-0").selectOption("single");
  await page.getByTestId("question-add-option-0").click();
  await page.getByTestId("question-0-option-0").fill("Option A");
  await page.getByTestId("question-add-option-0").click();
  await page.getByTestId("question-0-option-1").fill("Option B");
  await page.getByTestId("question-required-0").check();

  await page.getByTestId("add-question").click();
  await page.getByTestId("question-title-1").fill("Rate us");
  await page.getByTestId("question-type-1").selectOption("rating");

  // 调整顺序：把第 1 题（rating）上移到第 0 位
  await page.getByTestId("question-up-1").click();
  await expect(page.getByTestId("question-title-0")).toHaveValue("Rate us");
  await expect(page.getByTestId("question-title-1")).toHaveValue("Pick one");

  // 预览答题页：展示题目与选项
  await page.getByTestId("preview-survey").click();
  await expect(page.getByTestId("survey-preview")).toBeVisible();
  await expect(page.getByTestId("survey-preview")).toContainText("Multi-type Survey");
  await expect(page.getByTestId("survey-preview")).toContainText("Pick one");
  await expect(page.getByTestId("survey-preview")).toContainText("Option A");
  await expect(page.getByTestId("survey-preview")).toContainText("Option B");

  // 返回编辑保存
  await page.getByTestId("edit-survey").click();
  await page.getByTestId("save-survey").click();
  await expect(page.getByTestId("survey-created")).toBeVisible();
});

test("team 作用域：需选择已加入的团队，问卷对团队成员可见", async ({ page }) => {
  await register(page);
  const team = (await (await page.request.post("/api/teams", { data: { name: "Pulse Team" } })).json()).team;

  await page.goto("/surveys");
  await page.getByTestId("empty-new-survey").click();
  await page.getByTestId("survey-title").fill("Team Scoped Survey");
  await page.getByTestId("question-title-0").fill("Q1");
  await page.getByTestId("survey-scope").selectOption("team");
  await page.getByTestId("survey-team").selectOption(String(team.id));

  await page.getByTestId("save-survey").click();
  await expect(page.getByTestId("survey-created")).toBeVisible();
  await page.getByTestId("done-created").click();

  await expect(page.getByTestId("survey-list")).toContainText("Team Scoped Survey");
  await expect(page.getByTestId("survey-list")).toContainText("Team");
});

test("空标题被拒，问卷不保存（400）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/surveys", {
    data: { title: "   ", questions: [{ title: "Q1" }] },
  });
  expect(res.status()).toBe(400);
});

test("零题目被拒，问卷不保存（400）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/surveys", { data: { title: "No questions", questions: [] } });
  expect(res.status()).toBe(400);
});

test("未登录访问 /surveys 跳转登录", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/surveys");
  await expect(page).toHaveURL(/\/login/);
});
