import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { closePool, query } from "@repo/data";

interface ReportArtifactSummary {
  id: string;
  createdAt: string;
  newResponseCount: number;
  requirementHash: string;
  responseCount: number;
  sourceRevision: string;
  templateVersion: string;
}

interface ProfessionalReportPayload {
  report?: {
    chapters: Array<{
      outputType?: "image" | "chart" | "text";
      requirement?: string;
      chartTemplateId?: string;
      chart?: {
        templateId?: string;
        option?: { series?: Array<{ type?: string }> };
      };
    }>;
  };
  preview?: boolean;
  reused?: boolean;
  selectedArtifactId?: string | null;
  sessionId?: string;
  status?: "in_progress";
  generation: {
    currentResponseCount: number;
    currentRequirementHash: string;
    currentSourceRevision: string;
    requirementChanged: boolean;
    stale: boolean;
    versions: ReportArtifactSummary[];
  };
}

interface GenerationRecordCounts {
  session_count: string;
  trace_count: string;
}

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F16",
      email: `p25_f16_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

function expectNoRawResponseRecords(payload: unknown, ...canaries: string[]) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('"answers"');
  expect(serialized).not.toContain('"responses"');
  expect(serialized).not.toContain('"sourceData"');
  expect(serialized).not.toContain('"sourceSnapshot"');
  for (const canary of canaries) {
    expect(serialized).not.toContain(canary);
  }
}

async function countGenerationRecords(surveyId: number) {
  const rows = await query<GenerationRecordCounts>(
    `SELECT
       count(DISTINCT sessions.id)::text AS session_count,
       count(traces.id)::text AS trace_count
     FROM survey_ai_sessions sessions
     LEFT JOIN survey_ai_model_traces traces ON traces.session_id = sessions.id
     WHERE sessions.survey_id = $1
       AND sessions.kind = 'report'`,
    [surveyId]
  );
  return {
    sessions: Number(rows[0]?.session_count ?? 0),
    traces: Number(rows[0]?.trace_count ?? 0),
  };
}

async function expectNonEmptyCanvas(canvas: Locator) {
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext("2d");
    if (!context || element.width === 0 || element.height === 0) return 0;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let paintedPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      const alpha = pixels[index + 3] ?? 0;
      if (
        alpha > 0 &&
        (red < 245 || green < 245 || blue < 245)
      ) {
        paintedPixels += 1;
      }
    }
    return paintedPixels;
  })).toBeGreaterThan(100);
}

async function expectNonEmptyEChartsCanvas(page: Page) {
  await expectNonEmptyCanvas(
    page.getByTestId("report-chart-canvas").locator("canvas")
  );
}

async function expectCopiedOptionJson(
  page: Page,
  context: BrowserContext,
) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const option = page.getByTestId("report-chart-option-json");
  await expect(option).toContainText('"data": [');
  await expect(option).toContainText("150");
  await expect(option).toContainText('"type": "line"');
  await expect(option).toHaveJSProperty("tagName", "PRE");
  await expect(option).not.toHaveAttribute("contenteditable", "true");
  await expect(option.locator("input, textarea")).toHaveCount(0);

  const expectedOptionJson = await option.textContent();
  await page.getByRole("button", { name: "复制 Option JSON" }).click();
  await expect(page.getByRole("button", { name: "Option JSON 已复制" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expectedOptionJson);
  expect(JSON.parse(expectedOptionJson ?? "")).toEqual({
    xAxis: {
      type: "category",
      data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    yAxis: { type: "value" },
    series: [{
      data: [150, 230, 224, 218, 135, 147, 260],
      type: "line",
    }],
  });
}

test.afterAll(async () => {
  await closePool();
});

test("single-output report chapters persist and create exact immutable versions", async ({
  context,
  page,
}) => {
  test.slow();
  await page.setViewportSize({ width: 1653, height: 1024 });
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "商品安全决策调研",
      questions: [
        {
          title: "你最关注哪类安全信息？",
          type: "single",
          required: true,
          options: ["成分", "认证"],
          category: "安全认知",
        },
        {
          title: "补充说明",
          type: "text",
          required: true,
          options: [],
          category: "开放反馈",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as {
    id: number;
    questions: Array<{ id: number; type: string }>;
  };
  expect(
    (await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()
  ).toBe(200);
  const choiceQuestion = survey.questions.find((question) => question.type === "single")!;
  const textQuestion = survey.questions.find((question) => question.type === "text")!;
  const initialCanary = `F16_RAW_CANARY_${Date.now()}_${survey.id}`;
  const initialAnswer = await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: {
      answers: {
        [String(choiceQuestion.id)]: "成分",
        [String(textQuestion.id)]: initialCanary,
      },
    },
  });
  expect(initialAnswer.status()).toBe(201);

  const categoriesResponse = await page.request.get(`/api/surveys/${survey.id}/report-categories`);
  const categoryPlan = (await categoriesResponse.json()).reportCategoryPlan;
  categoryPlan.categories[0].requirement = "面向管理层，先给结论，再说明证据边界和行动建议。";
  const savedPlan = await page.request.patch(`/api/surveys/${survey.id}/report-categories`, {
    data: categoryPlan,
  });
  expect(savedPlan.status()).toBe(200);

  const beforeGeneration = await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  const beforePayload = await beforeGeneration.json() as ProfessionalReportPayload;
  expect(beforePayload.preview).toBe(true);
  expect(beforePayload.generation.currentResponseCount).toBe(1);
  expect(beforePayload.generation.versions).toHaveLength(0);
  expectNoRawResponseRecords(beforePayload, initialCanary);

  const concurrentGenerations = await Promise.all([
    page.request.post(`/api/surveys/${survey.id}/professional-report`, { data: {} }),
    page.request.post(`/api/surveys/${survey.id}/professional-report`, { data: {} }),
  ]);
  const concurrentPayloads = await Promise.all(
    concurrentGenerations.map(
      async (response) => ({
        status: response.status(),
        payload: await response.json() as ProfessionalReportPayload,
      })
    )
  );
  const newlyGenerated = concurrentPayloads.filter(
    ({ status, payload }) => status === 200 && payload.reused === false
  );
  expect(newlyGenerated).toHaveLength(1);
  expect(concurrentPayloads.some(({ status, payload }) =>
    status === 202
      ? payload.status === "in_progress"
      : status === 200 && payload.reused === true
  )).toBe(true);
  for (const { status, payload } of concurrentPayloads) {
    expect([200, 202]).toContain(status);
    expectNoRawResponseRecords(payload, initialCanary);
  }
  const firstPayload = newlyGenerated[0]!.payload;
  expect(firstPayload.generation.versions).toHaveLength(1);
  expectNoRawResponseRecords(firstPayload, initialCanary);
  const firstVersion = firstPayload.generation.versions[0]!;
  expect(await countGenerationRecords(survey.id)).toEqual({
    sessions: 1,
    traces: 1,
  });

  const reusedGeneration = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: {},
  });
  expect(reusedGeneration.status()).toBe(200);
  const reusedPayload = await reusedGeneration.json() as ProfessionalReportPayload;
  expect(reusedPayload.reused).toBe(true);
  expect(reusedPayload.generation.versions).toEqual([firstVersion]);
  expectNoRawResponseRecords(reusedPayload, initialCanary);

  const loadedPlanResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/report-categories`) &&
    response.request().method() === "GET"
  );
  const loadedReportResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/professional-report`) &&
    response.request().method() === "GET"
  );
  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  const loadedPlanPayload = await (await loadedPlanResponse).json();
  const loadedReportPayload = await (await loadedReportResponse).json() as ProfessionalReportPayload;
  expect(loadedPlanPayload.reportCategoryPlan.categories[0].requirement).toBe(
    "面向管理层，先给结论，再说明证据边界和行动建议。"
  );
  expect(loadedReportPayload.generation.versions).toEqual([firstVersion]);
  expectNoRawResponseRecords(loadedReportPayload, initialCanary);

  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  await expect(page.getByTestId("report-module-list")).toBeVisible();
  await expect(page.getByTestId("report-requirement-panel")).toBeVisible();
  await expect(page.getByTestId("report-preview-panel")).toBeVisible();
  await expect(page.getByTestId("report-output-type")).toBeVisible();
  await expect(page.getByTestId("professional-report-document")).toHaveCount(0);
  await expect(page.getByTestId("report-version-history")).toHaveCount(0);
  await expect(page.getByText("问题来源", { exact: true })).toHaveCount(0);
  await expect(page.getByText("输出模块", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("report-mapping-panel")).toHaveCount(0);

  await page.getByRole("button", { name: "图表", exact: true }).click();
  await expect(page.getByRole("button", { name: /基础折线图/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByTestId("generate-versioned-report")).toBeDisabled();
  await expect(page.getByTestId("report-generation-eligibility")).toContainText("先保存");
  await expect(page.getByTestId("report-chart-canvas")).toBeVisible();
  await expectNonEmptyEChartsCanvas(page);

  await page.getByRole("tab", { name: "Option JSON" }).click();
  await expectCopiedOptionJson(page, context);
  await page.getByRole("tab", { name: "效果预览" }).click();
  await expectNonEmptyEChartsCanvas(page);

  const savedChartPlanResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/report-categories`) &&
    response.request().method() === "PATCH"
  );
  await page.getByTestId("save-report-plan").click();
  const savedChartPlanPayload = await (await savedChartPlanResponse).json();
  expect(savedChartPlanPayload.reportCategoryPlan.categories[0]).toMatchObject({
    outputType: "chart",
    chartTemplateId: "line-simple",
  });
  await expect(page.getByTestId("report-generation-status")).toContainText("要求已修改");
  const changedChartStatusResponse =
    await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  const changedChartStatusPayload =
    await changedChartStatusResponse.json() as ProfessionalReportPayload;
  expect(changedChartStatusPayload.generation.requirementChanged).toBe(true);
  expect(changedChartStatusPayload.generation.currentSourceRevision)
    .toBe(firstVersion.sourceRevision);
  expect(changedChartStatusPayload.generation.currentRequirementHash)
    .not.toBe(firstVersion.requirementHash);
  expectNoRawResponseRecords(changedChartStatusPayload, initialCanary);
  await expect(page.getByTestId("generate-versioned-report")).toBeEnabled();

  await page.reload();
  await expect(page.getByRole("button", { name: "图表", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByRole("button", { name: /基础折线图/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expectNonEmptyEChartsCanvas(page);

  const [requirementBox, previewBox] = await Promise.all([
    page.getByTestId("report-requirement-panel").boundingBox(),
    page.getByTestId("report-preview-panel").boundingBox(),
  ]);
  expect(requirementBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(requirementBox!.x).toBeLessThan(previewBox!.x);
  expect(Math.abs(requirementBox!.y - previewBox!.y)).toBeLessThanOrEqual(2);
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-16/evidence/survey-report-single-output-desktop.png",
  });

  const chartGenerationResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/professional-report`) &&
    response.request().method() === "POST"
  );
  await page.getByTestId("generate-versioned-report").click();
  const chartGenerationPayload =
    await (await chartGenerationResponse).json() as ProfessionalReportPayload;
  expect(chartGenerationPayload.reused).toBe(false);
  expect(chartGenerationPayload.generation.versions).toHaveLength(2);
  expect(chartGenerationPayload.generation.versions).toContainEqual(firstVersion);
  expectNoRawResponseRecords(chartGenerationPayload, initialCanary);
  expect(chartGenerationPayload.report?.chapters[0]).toMatchObject({
    outputType: "chart",
    chartTemplateId: "line-simple",
    chart: {
      templateId: "line-simple",
      option: { series: [{ type: "line" }] },
    },
  });
  const chartVersion = chartGenerationPayload.generation.versions.find(
    (version) => version.id !== firstVersion.id
  )!;
  expect(chartVersion.sourceRevision).toBe(firstVersion.sourceRevision);
  expect(chartVersion.templateVersion).toBe(firstVersion.templateVersion);
  expect(chartVersion.requirementHash).not.toBe(firstVersion.requirementHash);

  const textRequirement =
    `文本版管理摘要 ${Date.now()}：只展示聚合结论、样本边界和行动建议。`;
  await page.getByRole("button", { name: "文本", exact: true }).click();
  await page.getByTestId("report-requirement-input").fill(textRequirement);
  await expect(page.getByTestId("generate-versioned-report")).toBeDisabled();
  const savedTextPlanResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/report-categories`) &&
    response.request().method() === "PATCH"
  );
  await page.getByTestId("save-report-plan").click();
  const savedTextPlanPayload = await (await savedTextPlanResponse).json();
  expect(savedTextPlanPayload.reportCategoryPlan.categories[0]).toMatchObject({
    outputType: "text",
    requirement: textRequirement,
  });
  expect(savedTextPlanPayload.reportCategoryPlan.categories[0].chartTemplateId)
    .toBeUndefined();
  await expect(page.getByTestId("report-generation-status")).toContainText("要求已修改");
  const changedTextStatusResponse =
    await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  const changedTextStatusPayload =
    await changedTextStatusResponse.json() as ProfessionalReportPayload;
  expect(changedTextStatusPayload.generation.requirementChanged).toBe(true);
  expect(changedTextStatusPayload.generation.currentSourceRevision)
    .toBe(chartVersion.sourceRevision);
  expect(changedTextStatusPayload.generation.currentRequirementHash)
    .not.toBe(chartVersion.requirementHash);
  expectNoRawResponseRecords(changedTextStatusPayload, initialCanary);

  await page.reload();
  await expect(page.getByRole("button", { name: "文本", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.getByTestId("report-requirement-input")).toHaveValue(textRequirement);
  const reloadedTextPlan = await page.request.get(
    `/api/surveys/${survey.id}/report-categories`
  );
  const reloadedTextPlanPayload = await reloadedTextPlan.json();
  expect(reloadedTextPlanPayload.reportCategoryPlan.categories[0]).toMatchObject({
    outputType: "text",
    requirement: textRequirement,
  });
  expect(reloadedTextPlanPayload.reportCategoryPlan.categories[0].chartTemplateId)
    .toBeUndefined();

  const textGenerationResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/professional-report`) &&
    response.request().method() === "POST"
  );
  await page.getByTestId("generate-versioned-report").click();
  const textGenerationPayload =
    await (await textGenerationResponse).json() as ProfessionalReportPayload;
  expect(textGenerationPayload.reused).toBe(false);
  expect(textGenerationPayload.generation.versions).toHaveLength(3);
  expect(textGenerationPayload.generation.versions).toContainEqual(firstVersion);
  expect(textGenerationPayload.generation.versions).toContainEqual(chartVersion);
  expectNoRawResponseRecords(textGenerationPayload, initialCanary);
  expect(textGenerationPayload.report?.chapters[0]).toMatchObject({
    outputType: "text",
    requirement: textRequirement,
  });
  expect(textGenerationPayload.report?.chapters[0]?.chart).toBeUndefined();
  expect(textGenerationPayload.report?.chapters[0]?.chartTemplateId).toBeUndefined();
  const textVersion = textGenerationPayload.generation.versions.find(
    (version) =>
      version.id !== firstVersion.id &&
      version.id !== chartVersion.id
  )!;
  expect(textVersion.sourceRevision).toBe(chartVersion.sourceRevision);
  expect(textVersion.templateVersion).toBe(chartVersion.templateVersion);
  expect(textVersion.requirementHash).not.toBe(chartVersion.requirementHash);

  await page.getByTestId("open-analysis-report").click();
  await expect(page).toHaveURL(new RegExp(`survey=${survey.id}.*step=report`));
  await expect(page.getByTestId("workspace-report-workbench")).toBeVisible();
  await expect(page.getByTestId("professional-report-document")).toBeVisible();
  const history = page.getByTestId("report-version-history");
  await expect(history).toBeVisible();
  await expect(history.getByRole("button")).toHaveCount(3);

  const chartVersionButton = history.getByRole("button").filter({ hasText: "版本 2" });
  const chartVersionResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api/surveys/${survey.id}/professional-report` &&
      url.searchParams.get("artifactId") === chartVersion.id &&
      response.request().method() === "GET"
    );
  });
  await chartVersionButton.click();
  const exactChartVersionPayload =
    await (await chartVersionResponse).json() as ProfessionalReportPayload;
  expect(exactChartVersionPayload.selectedArtifactId).toBe(chartVersion.id);
  expect(exactChartVersionPayload.report?.chapters[0]?.chart?.option)
    .toMatchObject({ series: [{ type: "line" }] });
  await expectNonEmptyCanvas(
    page.locator('[data-testid^="professional-echarts-"] canvas').first()
  );

  const oldestVersionButton = history.getByRole("button").filter({ hasText: "版本 1" });
  const exactVersionResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api/surveys/${survey.id}/professional-report` &&
      url.searchParams.get("artifactId") === firstVersion.id &&
      response.request().method() === "GET"
    );
  });
  await oldestVersionButton.click();
  const exactVersionPayload =
    await (await exactVersionResponse).json() as ProfessionalReportPayload;
  expect(exactVersionPayload.selectedArtifactId).toBe(firstVersion.id);
  expect(exactVersionPayload.report).toEqual(firstPayload.report);
  expectNoRawResponseRecords(exactVersionPayload, initialCanary);
  await expect(oldestVersionButton).toHaveAttribute("aria-current", "true");

  const invalidArtifact = await page.request.get(
    `/api/surveys/${survey.id}/professional-report?artifactId=missing-artifact`
  );
  expect(invalidArtifact.status()).toBe(404);
  expect(await invalidArtifact.json()).toEqual({ error: "report_version_not_found" });

  expect(await countGenerationRecords(survey.id)).toEqual({
    sessions: 3,
    traces: 3,
  });
  const staleCanary = `F16_STALE_CANARY_${Date.now()}_${survey.id}`;
  const laterAnswer = await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: {
      answers: {
        [String(choiceQuestion.id)]: "认证",
        [String(textQuestion.id)]: staleCanary,
      },
    },
  });
  expect(laterAnswer.status()).toBe(201);

  const staleResponse = await page.request.get(
    `/api/surveys/${survey.id}/professional-report`
  );
  const stalePayload = await staleResponse.json() as ProfessionalReportPayload;
  expect(stalePayload.generation.stale).toBe(true);
  expect(stalePayload.generation.currentResponseCount).toBe(2);
  expect(stalePayload.generation.versions).toHaveLength(3);
  expect(stalePayload.generation.versions.map((version) => version.id)).toEqual(
    textGenerationPayload.generation.versions.map((version) => version.id)
  );
  expect(stalePayload.generation.versions.every(
    (version) => version.newResponseCount === 1
  )).toBe(true);
  expect(stalePayload.generation.currentSourceRevision)
    .not.toBe(textVersion.sourceRevision);
  expect(stalePayload.generation.currentRequirementHash)
    .toBe(textVersion.requirementHash);
  expectNoRawResponseRecords(stalePayload, initialCanary, staleCanary);
  expect(await countGenerationRecords(survey.id)).toEqual({
    sessions: 3,
    traces: 3,
  });

  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  await expect(page.getByTestId("report-generation-status")).toContainText("数据有更新");
  await expect(page.getByTestId("report-generation-status")).toContainText("新增 1 份答卷");
  await expect(page.getByTestId("generate-versioned-report")).toBeEnabled();
  expect(await countGenerationRecords(survey.id)).toEqual({
    sessions: 3,
    traces: 3,
  });

  const staleGenerationResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/professional-report`) &&
    response.request().method() === "POST"
  );
  await page.getByTestId("generate-versioned-report").click();
  const staleGenerationPayload =
    await (await staleGenerationResponse).json() as ProfessionalReportPayload;
  expect(staleGenerationPayload.reused).toBe(false);
  expect(staleGenerationPayload.generation.stale).toBe(false);
  expect(staleGenerationPayload.generation.versions).toHaveLength(4);
  const refreshedVersion = staleGenerationPayload.generation.versions.find(
    (version) => version.sourceRevision !== textVersion.sourceRevision
  )!;
  expect(refreshedVersion.requirementHash).toBe(textVersion.requirementHash);
  expect(refreshedVersion.templateVersion).toBe(textVersion.templateVersion);
  expectNoRawResponseRecords(
    staleGenerationPayload,
    initialCanary,
    staleCanary
  );
  expect(await countGenerationRecords(survey.id)).toEqual({
    sessions: 4,
    traces: 4,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
  await expect(page.getByTestId("professional-report-document")).toHaveCount(0);
  await expect(page.getByTestId("report-version-history")).toHaveCount(0);
});
