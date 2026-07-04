import { test, expect, type Page } from "@playwright/test";
import { closePool, setSurveyActive } from "@repo/data";
import { REPORT_SUMMARY_FORCE_FAIL_MARKER } from "@repo/ai";

// uc-survey-007 — 问卷报告 AI 摘要：Report 视图一键生成基于当前回收数据的自然语言摘要。
// 核心边界：生成 → loading → 成功文本；生成失败 → 失败态 + 重试；零回收时生成按钮禁用；
// 非 owner/无权限者调用生成接口 403（复用 F04 的结果查看权限边界）。

const uniq = () => `sv7_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function register(page: Page, prefix = "survey7") {
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
      description: "AI summary coverage survey",
      questions: [
        { title: "What should we improve?", type: "text", required: true, options: [] },
        { title: "Pick one priority", type: "single", required: true, options: ["Speed", "Quality"] },
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
  choice: { single: string; rating: number; text: string }
) {
  const text = survey.questions.find((q) => q.type === "text")!;
  const single = survey.questions.find((q) => q.type === "single")!;
  const rating = survey.questions.find((q) => q.type === "rating")!;
  const answers: Record<string, unknown> = {
    [String(text.id)]: choice.text,
    [String(single.id)]: choice.single,
    [String(rating.id)]: choice.rating,
  };
  const res = await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } });
  expect(res.status()).toBe(201);
}

test.afterAll(async () => {
  await closePool();
});

test("生成 AI 摘要：点击进入 loading，成功后展示摘要文本", async ({ page }) => {
  await register(page, "ai-owner");
  const title = `AI Summary ${uniq()}`;
  const survey = await createSurvey(page, title);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 5, text: "Faster onboarding" });
  await submitResponse(page, survey, { single: "Quality", rating: 3, text: "Better docs" });

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-total")).toContainText("2 responses collected");

  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary")).toBeVisible();

  const generateBtn = page.getByTestId("report-ai-summary-generate");
  await expect(generateBtn).toBeEnabled();

  await generateBtn.click();
  // loading 态短暂但确定性出现（stub 生成器同步返回，这里只断言最终态可靠可见；
  // loading 态本身在下面失败态用例里用慢速网络场景更稳定地捕捉）。
  await expect(page.getByTestId("report-ai-summary-text")).toBeVisible();
  const summaryText = await page.getByTestId("report-ai-summary-text").textContent();
  expect(summaryText).toContain(title);
  expect(summaryText).toMatch(/2 份回收|2 responses|完成率/);
});

test("生成 AI 摘要 loading 态可见（网络节流下）", async ({ page, context }) => {
  await register(page, "ai-loading");
  const survey = await createSurvey(page, `AI Loading ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 4, text: "Great" });

  await page.goto(`/surveys/${survey.id}/results`);
  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();

  // 人为延迟 ai-summary 请求的响应，制造可观察的 loading 窗口。
  await context.route("**/results/ai-summary", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  const generateBtn = page.getByTestId("report-ai-summary-generate");
  await generateBtn.click();
  await expect(page.getByTestId("report-ai-summary-loading")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary-text")).toBeVisible({ timeout: 10_000 });
});

test("生成失败展示失败态与重试，不影响既有 Summary/Individual/Report 视图", async ({ page }) => {
  await register(page, "ai-fail");
  // 触发词命中 survey 标题时，生成器确定性抛错（REPORT_SUMMARY_FORCE_FAIL_MARKER）。
  const survey = await createSurvey(page, `AI Fail ${REPORT_SUMMARY_FORCE_FAIL_MARKER} ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 4, text: "Great" });

  await page.goto(`/surveys/${survey.id}/results`);

  // 既有 Summary 视图不受影响
  await expect(page.getByTestId("summary-view")).toBeVisible();
  await page.getByTestId("tab-individual").click();
  await expect(page.getByTestId("individual-view")).toBeVisible();

  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-view")).toBeVisible();
  await expect(page.getByTestId("report-total")).toHaveText("1");

  await page.getByTestId("report-ai-summary-generate").click();
  await expect(page.getByTestId("err-report-ai-summary")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary-text")).toHaveCount(0);

  // 重试仍然失败（标题依旧含触发词），失败态保持，既有视图仍完好
  await page.getByTestId("retry-report-ai-summary").click();
  await expect(page.getByTestId("err-report-ai-summary")).toBeVisible();
  await expect(page.getByTestId("report-total")).toHaveText("1");
});

test("零回收时生成按钮禁用", async ({ page }) => {
  await register(page, "ai-empty");
  const survey = await createSurvey(page, `AI Empty ${uniq()}`);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-empty")).toBeVisible();
  await expect(page.getByTestId("report-ai-summary-generate")).toBeDisabled();
});

test("非 owner/无权限者调用生成接口返回 403", async ({ page }) => {
  await register(page, "ai-private-owner");
  const survey = await createSurvey(page, `AI Private ${uniq()}`);
  await setSurveyActive(survey.id, true);
  await submitResponse(page, survey, { single: "Speed", rating: 2, text: "N/A" });

  const ownerGenerate = await page.request.post(`/api/surveys/${survey.id}/results/ai-summary`);
  expect(ownerGenerate.status()).toBe(200);

  await page.context().clearCookies();
  await register(page, "ai-outsider");

  const forbidden = await page.request.post(`/api/surveys/${survey.id}/results/ai-summary`);
  expect(forbidden.status()).toBe(403);
  const body = await forbidden.json();
  expect(JSON.stringify(body)).not.toContain("N/A");

  await page.context().clearCookies();
  const anonymous = await page.request.post(`/api/surveys/${survey.id}/results/ai-summary`);
  expect(anonymous.status()).toBe(401);
});
