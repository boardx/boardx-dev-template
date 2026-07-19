import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F25",
      email: `p25_f25_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "统一视觉问卷",
      description: "验证五步工作流使用同一满屏视觉系统",
      questions: [{
        title: "你最关注哪个体验环节？",
        type: "single",
        required: true,
        options: ["设计", "发布", "报告"],
        category: "体验诊断",
      }],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as { id: number };
}

test("all workflow steps share one full-width visual frame", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1200 });
  await register(page);
  const survey = await createSurvey(page);

  await page.goto(`/surveys?survey=${survey.id}&step=design`, { waitUntil: "domcontentloaded" });
  const content = page.getByTestId("survey-workflow-content");
  await expect(content).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("survey-workflow-header")).toContainText("统一视觉问卷");
  const contentBox = await content.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(contentBox!.width).toBeGreaterThan(1800);
  await expect(page.getByTestId("survey-editor-screen")).toBeVisible();
  const designBox = await page.getByTestId("survey-editor-screen").boundingBox();
  expect(designBox!.x).toBe(contentBox!.x + 20);
  expect(designBox!.width).toBe(contentBox!.width - 40);
  await expect(page.getByTestId("editor-command-bar")).toHaveCount(0);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-25/evidence/design.png",
    fullPage: false,
  });

  for (const [step, testId] of [
    ["template", "workspace-template-workbench"],
    ["collect", "workspace-collect-workbench"],
    ["answer", "workspace-answer-workbench"],
    ["report", "report-generation-empty-state"],
  ] as const) {
    await page.getByTestId(`workflow-${step}`).click();
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 20_000 });
    const nextBox = await page.getByTestId("survey-workflow-content").boundingBox();
    expect(nextBox).toMatchObject({
      x: contentBox!.x,
      y: contentBox!.y,
      width: contentBox!.width,
    });
    await page.screenshot({
      path: `../../phases/phase-p25-survey/sprints/sprint-25/evidence/${step}.png`,
      fullPage: false,
    });
  }
});
