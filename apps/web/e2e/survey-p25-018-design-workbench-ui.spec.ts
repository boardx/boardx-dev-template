import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F18",
      email: `p25_f18_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "企业 AI 转型成熟度诊断",
      description: "了解战略共识、数据基础与人才能力，为管理层形成可执行的转型建议。",
      questions: [
        {
          title: "您所在的部门 / 职能是？",
          type: "single",
          required: true,
          options: ["高管 / 战略", "业务部门", "IT / 数据", "人力资源", "其他"],
          category: "demographics",
        },
        {
          title: "贵组织是否有明确的 AI 转型战略与路线图？",
          type: "rating",
          required: true,
          options: [],
          category: "strategy",
        },
        {
          title: "当前数据基础能否支持关键 AI 场景？",
          type: "multiple",
          required: false,
          options: ["数据标准统一", "质量可控", "权限清晰", "暂不具备"],
          category: "data",
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as { id: number };
}

test("design workbench matches the confirmed continuous editing flow", async ({ page }) => {
  await page.setViewportSize({ width: 1653, height: 933 });
  await register(page);
  const survey = await createSurvey(page);

  await page.goto(`/surveys?survey=${survey.id}&step=design`);

  await expect(page.getByTestId("survey-design-summary")).toBeVisible();
  await expect(page.getByTestId("workspace-question-0")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("survey-design-hypotheses")).toBeVisible();
  await expect(page.getByTestId("workspace-question-1")).toBeVisible();
  await expect(page.getByTestId("survey-ai-panel")).toBeVisible();
  await expect(page.getByText("题目大纲", { exact: true })).toHaveCount(0);

  await expect(page.getByTestId("design-preview")).toBeVisible();
  await expect(page.getByTestId("design-report-template")).toBeVisible();
  await expect(page.getByTestId("design-publish")).toBeVisible();
  await expect(page.getByTestId("workflow-design")).toHaveAttribute("aria-current", "step");

  const title = page.locator("#workspace-survey-title");
  await title.fill("企业 AI 转型诊断 2026");
  await expect(title).toHaveValue("企业 AI 转型诊断 2026");

  const secondRequired = page.getByLabel("问题 2 必填");
  await secondRequired.uncheck();
  await expect(secondRequired).not.toBeChecked();

  const secondQuestion = page.getByTestId("workspace-question-1");
  await secondQuestion.getByRole("button", { name: "上移" }).click();
  await expect(page.getByTestId("workspace-question-0").locator('input[id^="question-title-"]')).toHaveValue(
    "贵组织是否有明确的 AI 转型战略与路线图？"
  );

  const questionCount = await page.locator('[data-testid^="workspace-question-"]').count();
  await page.getByRole("button", { name: "添加问题", exact: true }).click();
  await expect(page.locator('[data-testid^="workspace-question-"]')).toHaveCount(questionCount + 1);

  await page.reload();
  await expect(page.getByTestId("survey-design-summary")).toBeVisible();
  await expect(page.getByTestId("workspace-question-0")).toBeVisible();
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-18/evidence/survey-design-workbench-desktop.png",
  });

  await page.getByTestId("design-report-template").click();
  await expect(page).toHaveURL(new RegExp(`survey=${survey.id}.*step=template`));
});

test("design workbench remains usable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  const survey = await createSurvey(page);

  await page.goto(`/surveys?survey=${survey.id}&step=design`);

  const shell = page.getByTestId("survey-workflow-shell");
  await expect(shell).toBeVisible();
  await expect(page.getByTestId("survey-design-summary")).toBeVisible();
  await expect(page.getByTestId("survey-ai-panel")).toBeVisible();

  const widths = await shell.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);

  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-18/evidence/survey-design-workbench-mobile.png",
    fullPage: true,
  });
});
