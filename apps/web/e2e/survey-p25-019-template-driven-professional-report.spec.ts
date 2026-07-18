import { expect, test, type Locator, type Page } from "@playwright/test";
import { closePool } from "@repo/data";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F19",
      email:
        `p25_f19_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
        + "@example.com",
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function expectNonEmptyCanvas(canvas: Locator) {
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate(
    (element: HTMLCanvasElement) => {
      const context = element.getContext("2d");
      if (!context || !element.width || !element.height) return 0;
      const pixels = context.getImageData(
        0,
        0,
        element.width,
        element.height
      ).data;
      let painted = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index] ?? 255;
        const green = pixels[index + 1] ?? 255;
        const blue = pixels[index + 2] ?? 255;
        const alpha = pixels[index + 3] ?? 0;
        if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) painted += 1;
      }
      return painted;
    }
  )).toBeGreaterThan(100);
}

test.afterAll(async () => {
  await closePool();
});

test("generates one ordered artifact per saved template chapter", async ({
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await register(page);

  const created = await page.request.post("/api/surveys", {
    data: {
      title: "产品安全管理层诊断",
      description: "识别安全信任与购买决策的关键证据。",
      questions: [
        {
          title: "你最关注哪类安全信息？",
          type: "single",
          required: true,
          options: ["第三方认证", "成分披露", "售后承诺"],
          category: "安全信任",
        },
        {
          title: "你是否愿意优先购买安全信息透明的产品？",
          type: "single",
          required: true,
          options: ["愿意", "不确定", "不愿意"],
          category: "购买决策",
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

  for (const answers of [
    ["第三方认证", "愿意"],
    ["第三方认证", "愿意"],
    ["成分披露", "不确定"],
  ]) {
    const response = await page.request.post(
      `/api/surveys/${survey.id}/responses`,
      {
        data: {
          answers: {
            [String(survey.questions[0]!.id)]: answers[0],
            [String(survey.questions[1]!.id)]: answers[1],
          },
        },
      }
    );
    expect(response.status()).toBe(201);
  }

  const plan = {
    title: "产品安全管理层诊断报告",
    description: "供经营管理层评审安全信任与购买决策。",
    categories: [
      {
        id: "management-summary",
        name: "管理层决策摘要",
        description: "",
        requirement: "先给结论，再说明业务含义和下一步动作。",
        questionIds: [],
        outputType: "text",
        inputModes: ["text"],
        prompt: "先给结论，再说明业务含义和下一步动作。",
        order: 1,
        isCustom: true,
      },
      {
        id: "trust-structure",
        name: "安全信任结构",
        description: "",
        requirement: "选择最能体现安全关注差异的题目。",
        questionIds: [],
        outputType: "chart",
        inputModes: ["chart"],
        chartTemplateId: "pie-simple",
        prompt: "选择最能体现安全关注差异的题目。",
        order: 2,
        isCustom: true,
      },
      {
        id: "decision-scenario",
        name: "购买决策场景",
        description: "",
        requirement: "生成专业、克制且不带文字数字的研究场景图。",
        questionIds: [],
        outputType: "image",
        inputModes: ["image"],
        prompt: "生成专业、克制且不带文字数字的研究场景图。",
        order: 3,
        isCustom: true,
      },
    ],
  };
  const saved = await page.request.patch(
    `/api/surveys/${survey.id}/report-categories`,
    { data: plan }
  );
  expect(saved.status()).toBe(200);

  const generated = await page.request.post(
    `/api/surveys/${survey.id}/professional-report`,
    { data: { model: "qwen-e2e-report" } }
  );
  expect(generated.status()).toBe(200);
  const payload = await generated.json();
  expect(payload.report.schemaVersion).toBe("template-driven-report-v1");
  expect(payload.report.chapters.map(
    (chapter: { chapterId: string; order: number; outputType: string }) => [
      chapter.chapterId,
      chapter.order,
      chapter.outputType,
    ]
  )).toEqual([
    ["management-summary", 1, "text"],
    ["trust-structure", 2, "chart"],
    ["decision-scenario", 3, "image"],
  ]);
  expect(payload.report).not.toHaveProperty("executiveSummary");
  expect(payload.report).not.toHaveProperty("methodology");
  expect(JSON.stringify(payload.report)).not.toContain("survey-reports/");

  const imageChapter = payload.report.chapters[2] as {
    assetUrl: string;
  };
  const imageResponse = await page.request.get(imageChapter.assetUrl);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toContain("image/png");
  expect((await imageResponse.body()).byteLength).toBeGreaterThan(50);

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("survey-professional-report-workbench"))
    .toBeVisible();
  await expect(page.getByTestId("professional-report-outline"))
    .toContainText("管理层决策摘要");
  await expect(page.getByTestId("professional-report-outline"))
    .toContainText("安全信任结构");
  await expect(page.getByTestId("professional-report-outline"))
    .toContainText("购买决策场景");
  await expect(page.getByTestId("professional-report-document"))
    .not.toContainText("执行摘要");
  await expect(page.getByTestId("professional-report-document"))
    .not.toContainText("研究方法");
  await expect(page.getByText("报告 AI", { exact: true })).toHaveCount(0);
  await expectNonEmptyCanvas(
    page.getByTestId("professional-echarts-trust-structure").locator("canvas")
  );
  await expect(page.getByTestId("professional-image-decision-scenario"))
    .toBeVisible();

  await page.screenshot({
    path:
      "../../phases/phase-p25-survey/sprints/sprint-19/evidence/report-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator("#report-chapter-select")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path:
      "../../phases/phase-p25-survey/sprints/sprint-19/evidence/report-mobile.png",
    fullPage: true,
  });
});
