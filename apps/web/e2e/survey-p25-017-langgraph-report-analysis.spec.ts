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

test("LangGraph report chapters share one fact snapshot and keep the last success on failure", async ({
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
  expect(generatedPayload.report.schemaVersion).toBe(
    "template-driven-report-v1"
  );
  expect(
    generatedPayload.report.chapters.every(
      (chapter: { outputType: string }) => chapter.outputType === "text"
    )
  ).toBe(true);
  expect(
    generatedPayload.report.chapters.some((chapter: { claims: Array<{ statement: string }> }) =>
      chapter.claims.some(
        (claim) =>
          claim.statement.includes("用户行为与关键场景") ||
          claim.statement.includes("满意度与体验评价")
      )
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

  const rePlanned = await page.request.patch(
    `/api/surveys/${survey.id}/report-categories`,
    {
      data: {
        title: "产品反馈决策调研 · 复核版",
        description: "管理层复核所用的另一版报告结构。",
        categories: [
          {
            id: "management-review",
            name: "管理层复核摘要",
            description: "",
            requirement: "先给结论，再说明业务含义和下一步动作。",
            questionIds: [],
            outputType: "text",
            inputModes: ["text"],
            prompt: "先给结论，再说明业务含义和下一步动作。",
            order: 1,
            isCustom: true,
          },
        ],
      },
    }
  );
  expect(rePlanned.status()).toBe(200);

  const failing = await page.request.post(
    `/api/surveys/${survey.id}/professional-report`,
    { data: { model: "missing:provider" } }
  );
  expect(failing.status()).toBe(500);

  const statusAfterFailure = await page.request.get(
    `/api/surveys/${survey.id}/professional-report`
  );
  const statusPayload = await statusAfterFailure.json();
  expect(statusPayload.generation.versions).toHaveLength(1);
  expect(statusPayload.generation.latestArtifact).not.toBeNull();

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("professional-report-document")).toBeVisible();
});
