import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F17",
      email: `p25_f17_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

test("LangGraph report chapters share one fact snapshot and recover from model failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1653, height: 1024 });
  await register(page);

  const created = await page.request.post("/api/surveys", {
    data: {
      title: "产品反馈决策调研",
      questions: [
        {
          title: "你是否购买过此类商品？",
          type: "single",
          required: true,
          options: ["是", "否"],
          category: "behavior",
        },
        {
          title: "你对商品整体满意度如何？",
          type: "rating",
          required: true,
          options: [],
          category: "satisfaction",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };
  expect(
    (
      await page.request.patch(`/api/surveys/${survey.id}`, {
        data: { isActive: true },
      })
    ).status()
  ).toBe(200);

  const detail = await page.request.get(`/api/surveys/${survey.id}`);
  const questions = (await detail.json()).survey.questions as Array<{
    id: number;
  }>;
  expect(questions).toHaveLength(2);

  for (const answers of [
    {
      [String(questions[0]!.id)]: "是",
      [String(questions[1]!.id)]: 5,
    },
    {
      [String(questions[0]!.id)]: "否",
      [String(questions[1]!.id)]: 3,
    },
  ]) {
    const response = await page.request.post(
      `/api/surveys/${survey.id}/responses`,
      { data: { answers } }
    );
    expect(response.status()).toBe(201);
  }

  const generated = await page.request.post(
    `/api/surveys/${survey.id}/professional-report`,
    { data: { model: "stub:survey-report" } }
  );
  expect(generated.status()).toBe(200);
  const generatedPayload = await generated.json();
  expect(generatedPayload.reused).toBe(false);
  expect(generatedPayload.model).toBe("stub:survey-report");
  expect(
    generatedPayload.report.executiveSummary.claims.some(
      (claim: { statement: string }) =>
        claim.statement.includes("用户行为与关键场景") ||
        claim.statement.includes("满意度与体验评价")
    )
  ).toBe(true);
  expect(JSON.stringify(generatedPayload)).not.toContain('"answers"');
  expect(JSON.stringify(generatedPayload)).not.toContain(
    "survey-source.jsonl"
  );

  const reused = await page.request.post(
    `/api/surveys/${survey.id}/professional-report`,
    { data: { model: "stub:survey-report" } }
  );
  const reusedPayload = await reused.json();
  expect(reusedPayload.reused).toBe(true);
  expect(reusedPayload.generation.versions).toHaveLength(1);

  const fallback = await page.request.post(
    `/api/surveys/${survey.id}/professional-report`,
    {
      data: {
        model: "missing:provider",
        instruction: "生成一个新的管理层复核版本",
      },
    }
  );
  expect(fallback.status()).toBe(200);
  const fallbackPayload = await fallback.json();
  expect(fallbackPayload.model).toBe("deterministic:evidence");
  expect(fallbackPayload.warning).toContain("可稍后重新生成");
  expect(fallbackPayload.report.executiveSummary.claims.length).toBeGreaterThan(
    0
  );
  expect(fallbackPayload.generation.versions).toHaveLength(2);

  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  await expect(page.getByTestId("professional-report-document")).toBeVisible();
  await expect(page.getByTestId("report-version-history")).toContainText(
    "2 个版本"
  );
});
