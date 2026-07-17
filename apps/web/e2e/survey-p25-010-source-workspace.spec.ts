import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F10",
      email: `p25_f10_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "五步工作台调研",
      description: "验证源快照工作流",
      questions: [
        { title: "你关注什么？", type: "multiple", required: true, options: ["安全", "价格"], category: "需求洞察" },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as { id: number };
}

test("survey workspace restores every source workflow step from the URL", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);
  await page.goto("/surveys?view=my");
  await page.getByTestId(`open-workspace-${survey.id}`).click();

  await expect(page).toHaveURL(new RegExp(`survey=${survey.id}.*step=design`));
  await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
  await expect(page.getByTestId("survey-workflow-shell")).toContainText("五步工作台调研");
  await expect(page.getByTestId("workflow-design")).toHaveAttribute("aria-current", "step");
  await expect(page.locator("#workflow-category-0")).toHaveValue("需求洞察");

  for (const [step, testId] of [
    ["template", "workspace-template-workbench"],
    ["collect", "workspace-collect-workbench"],
    ["answer", "workspace-answer-workbench"],
    ["report", "workspace-report-workbench"],
  ] as const) {
    await page.getByTestId(`workflow-${step}`).click();
    await expect(page).toHaveURL(new RegExp(`step=${step}`));
    await page.reload();
    await expect(page.getByTestId(testId)).toBeVisible();
  }

  await page.getByTestId("workflow-answer").click();
  await expect(page.getByTestId("workspace-answer-link")).toHaveAttribute("href", `/survey/${survey.id}/answer`);
  await page.getByTestId("workflow-report").click();
  await expect(page.getByTestId("workspace-report-link")).toHaveAttribute("href", `/surveys/${survey.id}/results`);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("survey-insight-report")).toBeVisible();
});

test("workflow navigation remains usable on a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  const survey = await createSurvey(page);
  await page.goto(`/surveys?survey=${survey.id}&step=design`);

  const shell = page.getByTestId("survey-workflow-shell");
  await expect(shell).toBeVisible();
  const widths = await shell.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  await expect(page.getByTestId("workflow-report")).toBeVisible();
});
