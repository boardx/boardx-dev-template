import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

interface ReportArtifactSummary {
  id: string;
  createdAt: string;
  requirementHash: string;
  responseCount: number;
  sourceRevision: string;
  templateVersion: string;
}

interface ProfessionalReportPayload {
  report?: unknown;
  preview?: boolean;
  reused?: boolean;
  selectedArtifactId?: string | null;
  generation: {
    requirementChanged: boolean;
    versions: ReportArtifactSummary[];
  };
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

function expectNoRawResponseRecords(payload: unknown) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('"answers"');
  expect(serialized).not.toContain('"responses"');
  expect(serialized).not.toContain('"sourceData"');
  expect(serialized).not.toContain('"sourceSnapshot"');
}

async function expectNonEmptyEChartsCanvas(page: Page) {
  const canvas = page.getByTestId("report-chart-canvas").locator("canvas");
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
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };
  expect(
    (await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()
  ).toBe(200);

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
  expect(beforePayload.generation.versions).toHaveLength(0);
  expectNoRawResponseRecords(beforePayload);

  const firstGeneration = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: {},
  });
  expect(firstGeneration.status()).toBe(200);
  const firstPayload = await firstGeneration.json() as ProfessionalReportPayload;
  expect(firstPayload.reused).toBe(false);
  expect(firstPayload.generation.versions).toHaveLength(1);
  expectNoRawResponseRecords(firstPayload);
  const firstVersion = firstPayload.generation.versions[0]!;

  const reusedGeneration = await page.request.post(`/api/surveys/${survey.id}/professional-report`, {
    data: {},
  });
  const reusedPayload = await reusedGeneration.json() as ProfessionalReportPayload;
  expect(reusedPayload.reused).toBe(true);
  expect(reusedPayload.generation.versions).toEqual([firstVersion]);
  expectNoRawResponseRecords(reusedPayload);

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
  expectNoRawResponseRecords(loadedReportPayload);

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
  expectNoRawResponseRecords(changedChartStatusPayload);
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
  expectNoRawResponseRecords(chartGenerationPayload);
  const chartVersion = chartGenerationPayload.generation.versions.find(
    (version) => version.id !== firstVersion.id
  )!;

  await page.getByRole("button", { name: "图片", exact: true }).click();
  await expect(page.getByTestId("generate-versioned-report")).toBeDisabled();
  const savedImagePlanResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/report-categories`) &&
    response.request().method() === "PATCH"
  );
  await page.getByTestId("save-report-plan").click();
  const savedImagePlanPayload = await (await savedImagePlanResponse).json();
  expect(savedImagePlanPayload.reportCategoryPlan.categories[0].outputType).toBe("image");
  expect(savedImagePlanPayload.reportCategoryPlan.categories[0].chartTemplateId).toBeUndefined();
  await expect(page.getByTestId("report-generation-status")).toContainText("要求已修改");
  const changedImageStatusResponse =
    await page.request.get(`/api/surveys/${survey.id}/professional-report`);
  const changedImageStatusPayload =
    await changedImageStatusResponse.json() as ProfessionalReportPayload;
  expect(changedImageStatusPayload.generation.requirementChanged).toBe(true);
  expectNoRawResponseRecords(changedImageStatusPayload);

  const imageGenerationResponse = page.waitForResponse((response) =>
    response.url().includes(`/api/surveys/${survey.id}/professional-report`) &&
    response.request().method() === "POST"
  );
  await page.getByTestId("generate-versioned-report").click();
  const imageGenerationPayload =
    await (await imageGenerationResponse).json() as ProfessionalReportPayload;
  expect(imageGenerationPayload.reused).toBe(false);
  expect(imageGenerationPayload.generation.versions).toHaveLength(3);
  expect(imageGenerationPayload.generation.versions).toContainEqual(firstVersion);
  expect(imageGenerationPayload.generation.versions).toContainEqual(chartVersion);
  expectNoRawResponseRecords(imageGenerationPayload);

  await page.getByTestId("open-analysis-report").click();
  await expect(page).toHaveURL(new RegExp(`survey=${survey.id}.*step=report`));
  await expect(page.getByTestId("workspace-report-workbench")).toBeVisible();
  await expect(page.getByTestId("professional-report-document")).toBeVisible();
  const history = page.getByTestId("report-version-history");
  await expect(history).toBeVisible();
  await expect(history.getByRole("button")).toHaveCount(3);

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
  expectNoRawResponseRecords(exactVersionPayload);
  await expect(oldestVersionButton).toHaveAttribute("aria-current", "true");

  const invalidArtifact = await page.request.get(
    `/api/surveys/${survey.id}/professional-report?artifactId=missing-artifact`
  );
  expect(invalidArtifact.status()).toBe(404);
  expect(await invalidArtifact.json()).toEqual({ error: "report_version_not_found" });

  let releaseGeneration!: () => void;
  let markGenerationStarted!: () => void;
  const generationHeld = new Promise<void>((resolve) => {
    releaseGeneration = resolve;
  });
  const generationStarted = new Promise<void>((resolve) => {
    markGenerationStarted = resolve;
  });
  const holdGeneration = async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    markGenerationStarted();
    await generationHeld;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...imageGenerationPayload, reused: true }),
    });
  };
  await page.route(
    `**/api/surveys/${survey.id}/professional-report`,
    holdGeneration
  );
  const analysisGenerate = page
    .getByTestId("workspace-report-workbench")
    .getByRole("button", { name: "生成报告" });
  await analysisGenerate.click();
  await generationStarted;
  try {
    for (const button of await history.getByRole("button").all()) {
      await expect(button).toBeDisabled();
    }
  } finally {
    releaseGeneration();
  }
  await expect(analysisGenerate).toBeEnabled();
  await page.unroute(
    `**/api/surveys/${survey.id}/professional-report`,
    holdGeneration
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/surveys?survey=${survey.id}&step=template`);
  await expect(page.getByTestId("report-template-builder")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  ).toBe(true);
  await expect(page.getByTestId("professional-report-document")).toHaveCount(0);
  await expect(page.getByTestId("report-version-history")).toHaveCount(0);
});
