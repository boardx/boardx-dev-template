import { test, expect } from "@playwright/test";
import { closePool, countResponses, setSurveyActive } from "@repo/data";

// uc-survey-003-answer-survey — 公开答题页：访客无需登录、题型控件、必填校验、提交落库、发布门控。

const uniq = () => `sv_answer_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Survey", lastName: "Owner", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function createSurvey(page: import("@playwright/test").Page, title = "Public Pulse Survey") {
  await register(page);
  const res = await page.request.post("/api/surveys", {
    data: {
      title,
      description: "A short public check-in.",
      questions: [
        { title: "What should we improve?", type: "text", required: true, options: [] },
        { title: "Pick one priority", type: "single", required: true, options: ["Speed", "Quality"] },
        { title: "Which channels work?", type: "multiple", required: true, options: ["Email", "Chat"] },
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

test.afterAll(async () => {
  await closePool();
});

test("访客打开公开答题页，完成必填校验并提交落库", async ({ page }) => {
  const survey = await createSurvey(page);
  await setSurveyActive(survey.id, true);
  await page.context().clearCookies();

  const textQuestion = survey.questions.find((q) => q.type === "text")!;
  const singleQuestion = survey.questions.find((q) => q.type === "single")!;
  const multipleQuestion = survey.questions.find((q) => q.type === "multiple")!;
  const ratingQuestion = survey.questions.find((q) => q.type === "rating")!;

  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("survey-answer-title")).toHaveText("Public Pulse Survey");
  await expect(page.getByTestId("survey-answer-description")).toContainText("short public check-in");
  await expect(page.getByTestId("survey-progress")).toContainText("0 answered");

  await page.getByTestId("submit-survey-response").click();
  await expect(page.getByTestId("err-form")).toContainText("Please answer all required questions.");
  await expect(page.getByTestId(`err-question-${textQuestion.id}`)).toContainText("required");

  await page.getByTestId(`answer-text-${textQuestion.id}`).fill("Improve onboarding.");
  await page.getByTestId(`answer-single-${singleQuestion.id}-Speed`).check();
  await page.getByTestId(`answer-multiple-${multipleQuestion.id}-Email`).check();
  await page.getByTestId(`answer-rating-${ratingQuestion.id}-4`).click();
  await expect(page.getByTestId("survey-progress")).toContainText("100%");

  await page.getByTestId("submit-survey-response").click();
  await expect(page.getByTestId("survey-success")).toBeVisible();
  await expect(page.getByTestId("survey-success")).toContainText("Response submitted");
  await expect(await countResponses(survey.id)).toBe(1);
});

test("未发布问卷公开链接展示不可答题态", async ({ page }) => {
  const survey = await createSurvey(page, "Draft Survey");
  await page.context().clearCookies();

  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("survey-unavailable")).toBeVisible();
  await expect(page.getByTestId("survey-unavailable")).toContainText("Draft Survey");
  await expect(page.getByTestId("err-unavailable")).toContainText("not accepting responses");
  await expect(page.getByTestId("submit-survey-response")).toHaveCount(0);
});
