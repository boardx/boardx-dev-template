import { test, expect, type Page } from "@playwright/test";
import { closePool, setSurveyActive } from "@repo/data";

// uc-survey-004-view-answers-report — 查看答卷与报告：Summary（按题聚合）/ Individual（逐份浏览）/
// Report（分析报告 + 导出）。核心边界：无回收时空态；仅创建者/团队成员可查看（安全对齐 F03 review 加固）；
// 导出失败可重试。

const uniq = () => `sv4_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function register(page: Page, prefix = "survey4") {
  const email = `${prefix}_${uniq()}@ex.com`;
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email, password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function createSurvey(page: Page, title: string) {
  const res = await page.request.post("/api/surveys", {
    data: {
      title,
      description: "Report coverage survey",
      questions: [
        { title: "What should we improve?", type: "text", required: true, options: [] },
        { title: "Pick one priority", type: "single", required: true, options: ["Speed", "Quality"] },
        { title: "Which channels work?", type: "multiple", required: false, options: ["Email", "Chat"] },
        { title: "Rate the experience", type: "rating", required: true, options: [] },
      ],
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).survey as {
    id: number;
    shareUrl: string;
    questions: Array<{ id: number; title: string; type: string }>;
  };
}

async function submitResponse(
  page: Page,
  survey: { id: number; questions: Array<{ id: number; title: string; type: string }> },
  choice: { single: string; multiple?: string[]; rating: number; text: string }
) {
  const text = survey.questions.find((q) => q.type === "text")!;
  const single = survey.questions.find((q) => q.type === "single")!;
  const multiple = survey.questions.find((q) => q.type === "multiple")!;
  const rating = survey.questions.find((q) => q.type === "rating")!;
  const answers: Record<string, unknown> = {
    [String(text.id)]: choice.text,
    [String(single.id)]: choice.single,
    [String(rating.id)]: choice.rating,
  };
  if (choice.multiple) answers[String(multiple.id)] = choice.multiple;
  const res = await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } });
  expect(res.status()).toBe(201);
}

test.afterAll(async () => {
  await closePool();
});

test("无回收时展示空态", async ({ page }) => {
  await register(page, "empty-owner");
  const title = `Empty Report ${uniq()}`;
  const survey = await createSurvey(page, title);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-title")).toHaveText(title);
  await expect(page.getByTestId("results-total")).toContainText("0 responses collected");
  await expect(page.getByTestId("results-empty")).toBeVisible();
});

test("Summary/Individual/Report 三视图按题聚合、逐份浏览、报告统计", async ({ page }) => {
  await register(page, "report-owner");
  const survey = await createSurvey(page, `Full Report ${uniq()}`);
  await setSurveyActive(survey.id, true);

  await submitResponse(page, survey, { single: "Speed", multiple: ["Email", "Chat"], rating: 5, text: "Faster onboarding" });
  await submitResponse(page, survey, { single: "Quality", multiple: ["Email"], rating: 3, text: "Better docs" });

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-total")).toContainText("2 responses collected");

  // Summary：按题聚合，占比条形图 + 均值
  await expect(page.getByTestId("summary-view")).toBeVisible();
  const singleQ = survey.questions.find((q) => q.type === "single")!;
  const ratingQ = survey.questions.find((q) => q.type === "rating")!;
  await expect(page.getByTestId(`summary-question-${singleQ.id}`)).toContainText("2 answered");
  await expect(page.getByTestId(`summary-average-${ratingQ.id}`)).toContainText("4");

  // Individual：逐份浏览
  await page.getByTestId("tab-individual").click();
  await expect(page.getByTestId("individual-view")).toBeVisible();
  await expect(page.locator('[data-testid^="response-"]').first()).toBeVisible();

  // Report：生成分析报告统计
  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();
  await expect(page.getByTestId("report-total")).toHaveText("2");
  await expect(page.getByTestId(`report-question-${singleQ.id}`)).toBeVisible();
});

test("导出 CSV 下载答卷数据", async ({ page }) => {
  await register(page, "export-owner");
  const survey = await createSurvey(page, `Export Report ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 4, text: "Great" });

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-total")).toContainText("1 responses collected");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
  expect(download.suggestedFilename()).toBe(`survey-${survey.id}-responses.csv`);
});

test("仅创建者/团队成员可查看报告，未授权访问被拒绝", async ({ page }) => {
  await register(page, "private-owner");
  const survey = await createSurvey(page, `Private Report ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 2, text: "N/A" });

  const directApi = await page.request.get(`/api/surveys/${survey.id}/results`);
  expect(directApi.status()).toBe(200);

  await page.context().clearCookies();
  await register(page, "outsider");

  const forbiddenApi = await page.request.get(`/api/surveys/${survey.id}/results`);
  expect(forbiddenApi.status()).toBe(403);
  const body = await forbiddenApi.json();
  expect(JSON.stringify(body)).not.toContain("Great");

  const forbiddenExport = await page.request.get(`/api/surveys/${survey.id}/results/export`);
  expect(forbiddenExport.status()).toBe(403);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-forbidden")).toBeVisible();

  // 未登录访客：answer API 仍公开（题目/选项），但结果报告 API 必须要求登录
  await page.context().clearCookies();
  const anonymous = await page.request.get(`/api/surveys/${survey.id}/results`);
  expect(anonymous.status()).toBe(401);
});
