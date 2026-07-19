import { expect, test, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F23",
      email:
        `p25_f23_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
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

test("explains that a report needs responses before generation", async ({
  page,
}) => {
  await register(page);

  const created = await page.request.post("/api/surveys", {
    data: {
      title: "待回收答卷问卷",
      description: "验证无答卷时不会发起报告生成。",
      questions: [
        {
          title: "你最关注哪个方向？",
          type: "single",
          required: true,
          options: ["产品", "服务"],
          category: "关注方向",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  const generationRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      request.method() === "POST"
      && url.pathname === `/api/surveys/${survey.id}/professional-report`
    ) {
      generationRequests.push(request.url());
    }
  });

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("report-generation-empty-state"))
    .toContainText("收到至少 1 份有效答卷后可生成报告");
  await expect(page.getByRole("button", { name: "重新生成" }))
    .toBeDisabled();
  await expect(page.getByText("professional_report_generation_failed"))
    .toHaveCount(0);
  expect(generationRequests).toEqual([]);

  await page.screenshot({
    path:
      "../../phases/phase-p25-survey/sprints/sprint-23/evidence/report-generation-empty-state.png",
    fullPage: true,
  });
});
