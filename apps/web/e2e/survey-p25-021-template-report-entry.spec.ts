import { expect, test, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F21",
      email:
        `p25_f21_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
        + "@example.com",
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

test.afterAll(async () => {
  await closePool();
});

test("opens and regenerates the template-driven report from the designer", async ({
  page,
}) => {
  test.slow();
  await register(page);

  const created = await page.request.post("/api/surveys", {
    data: {
      title: "报告入口回归问卷",
      description: "验证分析报告入口使用模板驱动生成流程。",
      questions: [
        {
          title: "你最关注哪个改进方向？",
          type: "single",
          required: true,
          options: ["产品体验", "服务响应"],
          category: "改进优先级",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as {
    id: number;
    questions: Array<{ id: number }>;
  };

  expect((await page.request.patch(`/api/surveys/${survey.id}`, {
    data: { isActive: true },
  })).status()).toBe(200);
  expect((await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: {
      answers: {
        [String(survey.questions[0]!.id)]: "产品体验",
      },
    },
  })).status()).toBe(201);

  expect((await page.request.patch(
    `/api/surveys/${survey.id}/report-categories`,
    {
      data: {
        title: "管理层改进优先级报告",
        description: "按模板生成管理层可执行结论。",
        categories: [
          {
            id: "priority-summary",
            name: "改进优先级摘要",
            description: "",
            requirement: "先给结论，再说明证据和下一步动作。",
            questionIds: [],
            outputType: "text",
            inputModes: ["text"],
            prompt: "先给结论，再说明证据和下一步动作。",
            order: 1,
            isCustom: true,
          },
        ],
      },
    }
  )).status()).toBe(200);

  expect((await page.request.post(
    `/api/surveys/${survey.id}/professional-report`,
    { data: { model: "qwen-e2e-report" } }
  )).status()).toBe(200);

  const legacyRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST"
      && new URL(request.url()).pathname.endsWith("/ai-report")
    ) {
      legacyRequests.push(request.url());
    }
  });
  await page.goto(`/surveys?survey=${survey.id}&step=design`);
  await page.getByTestId("workflow-report").click();

  await expect(page).toHaveURL(
    new RegExp(`survey=${survey.id}.*step=report`)
  );
  await expect(page.getByTestId("survey-professional-report-workbench"))
    .toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("professional-report-outline")).toHaveCount(0);
  await expect(page.getByTestId("professional-report-document"))
    .toContainText("改进优先级摘要");
  await expect(page.getByTestId("generate-ai-report")).toHaveCount(0);
  await expect(page.getByTestId("ai-report-error")).toHaveCount(0);

  const regenerated = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && new URL(response.url()).pathname.endsWith("/professional-report")
  );
  await page.getByRole("button", { name: "重新生成" }).click();
  expect((await regenerated).status()).toBe(200);
  await expect(page.getByTestId("professional-report-document"))
    .toContainText("改进优先级摘要");
  expect(legacyRequests).toEqual([]);
});
