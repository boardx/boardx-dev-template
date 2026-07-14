import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, prefix: string) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F12",
      email: `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

test("report categories fall back deterministically and remain owner-only", async ({ page }) => {
  await register(page, "p25_f12_owner");
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "小学生活调研",
      questions: [
        { title: "你对课堂满意吗？", type: "rating", required: true, options: [], category: "学习体验" },
        { title: "你最关注什么？", type: "multiple", required: false, options: ["作业", "活动"], category: "学习体验" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };
  const detail = await page.request.get(`/api/surveys/${survey.id}`);
  expect(detail.status()).toBe(200);
  const questionIds = ((await detail.json()).survey.questions as Array<{ id: number | string }>).map(({ id }) => String(id));

  const classified = await page.request.post(`/api/surveys/${survey.id}/report-categories`);
  expect(classified.status()).toBe(200);
  const payload = await classified.json();
  expect(payload.generatedBy).toMatch(/^(llm|default)$/);
  expect(payload.reportCategoryPlan.categories.length).toBeGreaterThan(0);
  expect(payload.reportCategoryPlan.categories.flatMap((category: { questionIds: Array<number | string> }) => category.questionIds.map(String))).toEqual(
    expect.arrayContaining(questionIds)
  );

  const reloaded = await page.request.get(`/api/surveys/${survey.id}/report-categories`);
  expect(reloaded.status()).toBe(200);
  expect((await reloaded.json()).reportCategoryPlan.categories.length).toBeGreaterThan(0);

  await register(page, "p25_f12_outsider");
  expect((await page.request.post(`/api/surveys/${survey.id}/report-categories`)).status()).toBe(403);
});
