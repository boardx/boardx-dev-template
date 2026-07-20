import { expect, test, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F26",
      email:
        `p25_f26_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
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

test("uses full-width workspaces and renders the saved empty report framework", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1200 });
  await register(page);

  const created = await page.request.post("/api/surveys", {
    data: {
      title: "全宽报告框架问卷",
      description: "验证设计、模板和报告工作区。",
      questions: [{
        title: "你最关注哪个经营环节？",
        type: "single",
        required: true,
        options: ["产品", "服务", "增长"],
        category: "经营诊断",
      }],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  const savedPlan = await page.request.patch(
    `/api/surveys/${survey.id}/report-categories`,
    {
      data: {
        title: "全宽经营诊断报告",
        description: "按管理层阅读顺序展示。",
        categories: [
          {
            id: "visual",
            name: "研究场景",
            description: "",
            requirement: "收到答卷后生成克制的研究视觉。",
            questionIds: [],
            outputType: "image",
            inputModes: ["image"],
            prompt: "收到答卷后生成克制的研究视觉。",
            order: 3,
            isCustom: true,
          },
          {
            id: "summary",
            name: "管理层摘要",
            description: "",
            requirement: "收到答卷后先给结论，再给证据。",
            questionIds: [],
            outputType: "text",
            inputModes: ["text"],
            prompt: "收到答卷后先给结论，再给证据。",
            order: 1,
            isCustom: true,
          },
          {
            id: "trend",
            name: "趋势对比",
            description: "",
            requirement: "收到答卷后比较关键维度。",
            questionIds: [],
            outputType: "chart",
            inputModes: ["chart"],
            chartTemplateId: "line-simple",
            prompt: "收到答卷后比较关键维度。",
            order: 2,
            isCustom: true,
          },
        ],
      },
    }
  );
  expect(savedPlan.status()).toBe(200);
  const emptyReport = await page.request.get(
    `/api/surveys/${survey.id}/professional-report`
  );
  expect(emptyReport.status()).toBe(200);
  expect((await emptyReport.json()).report.chapters).toHaveLength(3);

  await page.goto(`/surveys?survey=${survey.id}&step=design`);
  await expect(page.getByTestId("survey-editor-workspace")).toBeVisible({
    timeout: 20_000,
  });
  const designBox = await page.getByTestId("survey-editor-workspace").boundingBox();
  const builderBox = await page.getByTestId("question-builder-panel").boundingBox();
  const assistantBox = await page.getByTestId("survey-ai-assistant").boundingBox();
  expect(designBox).not.toBeNull();
  expect(builderBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  const designGrid = await page.getByTestId("survey-editor-workspace")
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns
      .split(" ")
      .map((value) => Number.parseFloat(value)));
  expect(designGrid).toHaveLength(2);
  const gridWidth = designGrid[0]! + designGrid[1]!;
  expect(designGrid[0]! / gridWidth).toBeGreaterThan(0.59);
  expect(designGrid[0]! / gridWidth).toBeLessThan(0.61);
  expect(designGrid[1]! / gridWidth).toBeGreaterThan(0.39);
  expect(assistantBox!.width / designBox!.width).toBeGreaterThan(0.36);

  await page.getByTestId("workflow-template").click();
  const workflowContent = page.getByTestId("survey-workflow-content");
  const templateWorkspace = page.getByTestId("workspace-report-composer");
  await expect(templateWorkspace).toBeVisible({ timeout: 20_000 });
  const workflowBox = await workflowContent.boundingBox();
  const templateBox = await templateWorkspace.boundingBox();
  expect(workflowBox).not.toBeNull();
  expect(templateBox).not.toBeNull();
  expect(Math.abs(templateBox!.width - (workflowBox!.width - 40))).toBeLessThanOrEqual(2);

  await page.getByTestId("workflow-report").click();
  const reportWorkbench = page.getByTestId("survey-professional-report-workbench");
  const readingSurface = page.getByTestId("professional-report-reading-surface");
  await expect(reportWorkbench).toBeVisible({ timeout: 20_000 });
  const reportBox = await reportWorkbench.boundingBox();
  const readingBox = await readingSurface.boundingBox();
  expect(reportBox).not.toBeNull();
  expect(readingBox).not.toBeNull();
  expect(Math.abs(readingBox!.width - reportBox!.width)).toBeLessThanOrEqual(2);

  await expect(page.getByTestId("professional-report-chapter-summary"))
    .toContainText("等待真实答卷后生成结论与证据");
  await expect(page.getByTestId("professional-report-chapter-trend"))
    .toContainText("ECharts 模板：line-simple");
  await expect(page.getByTestId("professional-report-chapter-visual"))
    .toContainText("等待真实答卷后生成研究视觉");
  expect(
    await page.locator("[data-report-chapter-state='framework']")
      .evaluateAll((nodes) => nodes.map((node) => node.id))
  ).toEqual([
    "report-chapter-summary",
    "report-chapter-trend",
    "report-chapter-visual",
  ]);
  await expect(page.getByRole("button", { name: "重新生成" })).toBeDisabled();
  await expect(page.locator("[data-report-chapter-state='framework'] canvas"))
    .toHaveCount(0);
  await expect(page.locator("[data-report-chapter-state='framework'] img"))
    .toHaveCount(0);

  await page.screenshot({
    path:
      "../../phases/phase-p25-survey/sprints/sprint-26/evidence/"
      + "fullwidth-report-framework-desktop.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId("professional-report-chapter-summary"))
    .toBeVisible({ timeout: 20_000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path:
      "../../phases/phase-p25-survey/sprints/sprint-26/evidence/"
      + "fullwidth-report-framework-mobile.png",
    fullPage: true,
  });
});
