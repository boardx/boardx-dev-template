import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F20",
      email: `p25_f20_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "入口一致性诊断问卷",
      description: "验证已有问卷进入统一设计器",
      questions: [
        {
          title: "当前最需要优先解决的问题是什么？",
          type: "single",
          required: true,
          options: ["数据基础", "流程协同"],
          category: "现状盘点",
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as { id: number };
}

async function expectUnifiedDesigner(page: Page) {
  await expect(page.getByTestId("survey-editor-shell")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("survey-editor-stepper")).toBeVisible();
  await expect(page.getByTestId("workflow-design")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("survey-hypotheses")).toBeVisible();
  await expect(page.getByTestId("survey-question-canvas")).toBeVisible();
  await expect(page.getByTestId("ai-assistant-panel")).toBeVisible();
  await expect(page.getByTestId("workspace-design-workbench")).toHaveCount(0);
}

test("existing surveys and templates open the same confirmed design experience", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1200 });
  await register(page);
  const survey = await createSurvey(page);

  await page.goto("/surveys?view=my");
  await page.getByTestId(`open-workspace-${survey.id}`).click();

  await expect(page).toHaveURL(new RegExp(`survey=${survey.id}.*step=design`));
  await expectUnifiedDesigner(page);
  await expect(page.getByTestId("question-title-0")).toHaveValue("当前最需要优先解决的问题是什么？");
  await expect(page.getByTestId("question-category-select-0")).toHaveValue("现状盘点");

  await page.reload();
  await expectUnifiedDesigner(page);
  await expect(page.getByTestId("question-title-0")).toHaveValue("当前最需要优先解决的问题是什么？");

  await page.goto("/surveys?view=templates");
  const templateCard = page.getByTestId("diagnostic-template-grid").locator("[data-testid^=template-card-]").first();
  const templateId = (await templateCard.getAttribute("data-testid"))?.replace("template-card-", "");
  expect(templateId).toBeTruthy();
  await page.getByTestId(`use-template-${templateId}`).click();

  await expectUnifiedDesigner(page);
  await expect(page.getByTestId("question-list").locator("[data-testid^=question-]")).not.toHaveCount(0);

  const layout = await page.getByTestId("survey-editor-shell").evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-20/evidence/unified-design-entry-desktop.png",
    fullPage: false,
  });
});
