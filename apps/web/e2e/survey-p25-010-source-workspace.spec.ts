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
        { title: "请评价当前成熟度", type: "rating", required: true, options: [], category: "组织成熟度" },
        { title: "你愿意推荐当前方案吗？", type: "nps", required: true, options: [], category: "推荐意愿" },
        { title: "最需要优先解决什么？", type: "text", required: false, options: [], category: "开放反馈" },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as {
    id: number;
    questions: Array<{ id: number; type: string }>;
  };
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
    await page.goto(`/surveys?survey=${survey.id}&step=${step}`);
    await expect(page).toHaveURL(new RegExp(`step=${step}`));
    await page.reload();
    await expect(page.getByTestId(testId)).toBeVisible();
  }

  await page.goto(`/surveys?survey=${survey.id}&step=answer`);
  await expect(page.getByTestId("workspace-answer-link")).toHaveAttribute("href", `/survey/${survey.id}/answer`);
  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("workspace-report-link")).toHaveAttribute("href", `/surveys/${survey.id}/results`);
  await page.getByTestId("survey-workflow-shell").getByRole("button", { name: "返回列表" }).click();
  await expect(page).toHaveURL(/\/surveys\?view=my$/);
  await expect(page.getByTestId("survey-list-screen")).toBeVisible();
});

test("insight report exposes the reference screen root", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);
  await page.goto(`/surveys/${survey.id}/results`);

  await expect(page.getByTestId("survey-insight-report")).toBeVisible();
});

test("insight report returns to the current survey editor route", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);
  await page.goto(`/surveys/${survey.id}/results?from=editor`);

  await page.getByTestId("back-to-survey-workspace").click({ noWaitAfter: true });

  await expect(page).toHaveURL(new RegExp(`/surveys\\?survey=${survey.id}&step=design$`));
});

test("insight report preserves workflow and direct-list return targets", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);

  for (const [source, expectedPath] of [
    [`?from=workflow&tab=report`, `/surveys?survey=${survey.id}&step=report`],
    [`?from=workflow&tab=individual`, `/surveys?survey=${survey.id}&step=answer`],
    ["", "/surveys?view=my"],
  ] as const) {
    await page.goto(`/surveys/${survey.id}/results${source}`);
    await page.getByTestId("back-to-survey-workspace").click({ noWaitAfter: true });
    await expect(page).toHaveURL(new RegExp(`${expectedPath.replaceAll("?", "\\?")}$`));
  }
});

test("populated insight report follows the diagnostic reference hierarchy", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);
  expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()).toBe(200);
  const answers = Object.fromEntries(survey.questions.map((question) => {
    if (question.type === "multiple") return [question.id, ["安全"]];
    if (question.type === "rating") return [question.id, 4];
    if (question.type === "nps") return [question.id, 9];
    return [question.id, "先明确数据责任，再启动小范围试点"];
  }));
  expect((await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } })).status()).toBe(201);

  const summaryResponse = await page.request.get(`/api/surveys/${survey.id}/responses`);
  expect(summaryResponse.status()).toBe(200);
  const summaryPayload = await summaryResponse.json() as {
    responses: Array<{ id?: number; answers: Record<string, unknown> }>;
  };
  const textQuestion = survey.questions.find((question) => question.type === "text")!;
  expect(summaryPayload.responses[0]?.id).toBeUndefined();
  expect(summaryPayload.responses[0]?.answers[String(textQuestion.id)]).toBe(true);
  expect(JSON.stringify(summaryPayload)).not.toContain("先明确数据责任，再启动小范围试点");

  const individualResponse = await page.request.get(`/api/surveys/${survey.id}/responses?view=individual`);
  expect(individualResponse.status()).toBe(200);
  expect(JSON.stringify(await individualResponse.json())).toContain("先明确数据责任，再启动小范围试点");

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("survey-insight-report-header")).toBeVisible();
  await expect(page.getByTestId("survey-ai-diagnostic-summary")).toBeVisible();
  await expect(page.getByTestId("survey-sample-quality")).toBeVisible();
  await expect(page.getByTestId("survey-hypothesis-validation")).toBeVisible();
  await expect(page.getByTestId("survey-dimension-analysis")).toBeVisible();
  await expect(page.getByTestId("survey-benchmark-analysis")).toBeVisible();
  await expect(page.getByTestId("survey-segment-analysis")).toBeVisible();
  await expect(page.getByTestId("survey-theme-analysis")).toBeVisible();
  await expect(page.getByTestId("survey-low-sample-limit")).toBeVisible();
  await expect(page.getByTestId("survey-hypothesis-validation").getByText("支持", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("survey-hypothesis-validation").getByText("不支持", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("survey-dimension-analysis")).not.toContainText("回答完整度");
  await expect(page.getByTestId("survey-enps-analysis")).toContainText("样本不足");
  await expect(page.locator("body")).not.toContainText("先明确数据责任，再启动小范围试点");
  await expect(page.locator("body")).not.toContainText("匿名答卷 #");
  await expect(page.getByTestId("survey-priority-matrix")).toBeVisible();
  await expect(page.getByTestId("survey-workshop-agenda")).toBeVisible();
  await page.getByTestId("tab-individual").click();
  await expect(page.getByTestId("individual-panel")).toContainText("先明确数据责任，再启动小范围试点");
  await page.getByTestId("tab-summary").click();
  await page.getByTestId("survey-insight-report-header").scrollIntoViewIfNeeded();
  await page.getByTestId("survey-results-scroll").evaluate((element) => {
    element.scrollLeft = 0;
  });
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-12/evidence/survey-insight-report-desktop.png",
    fullPage: true,
  });
});

test("diagnostic conclusions use each metric's effective sample size", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "有效样本量门控",
      description: "总答卷数不能替代指标有效样本数",
      questions: [
        { title: "可选成熟度 A", type: "rating", required: false, options: [], category: "成熟度" },
        { title: "可选成熟度 B", type: "rating", required: false, options: [], category: "成熟度" },
        { title: "充分样本成熟度", type: "rating", required: false, options: [], category: "充分样本" },
        { title: "可选推荐意愿", type: "nps", required: false, options: [], category: "推荐意愿" },
        { title: "补充说明", type: "text", required: false, options: [], category: "开放反馈" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as {
    id: number;
    questions: Array<{ id: number; type: string }>;
  };
  expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()).toBe(200);
  const ratingQuestions = survey.questions.filter((question) => question.type === "rating");
  const [firstRatingQuestion, secondRatingQuestion, reliableRatingQuestion] = ratingQuestions;
  const npsQuestion = survey.questions.find((question) => question.type === "nps")!;
  const submissions = Array.from({ length: 30 }, (_, index) =>
    page.request.post(`/api/surveys/${survey.id}/responses`, {
      data: {
        answers: {
          ...(index < 15
            ? { [firstRatingQuestion!.id]: 5, [secondRatingQuestion!.id]: 5 }
            : {}),
          [reliableRatingQuestion!.id]: 5,
          ...(index === 0 ? { [npsQuestion.id]: 10 } : {}),
        },
      },
    })
  );
  for (const response of await Promise.all(submissions)) expect(response.status()).toBe(201);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("results-count")).toHaveText("30");
  await expect(page.getByTestId("survey-low-sample-limit")).toContainText("有效样本");
  await expect(page.getByTestId("survey-hypothesis-validation").getByText("方向性", { exact: true })).toHaveCount(2);
  await expect(page.getByTestId("survey-hypothesis-validation").getByText("偏高", { exact: true })).toHaveCount(1);
  await expect(page.getByTestId("survey-hypothesis-validation").getByText("支持", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("survey-hypothesis-validation").getByText("不支持", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("survey-enps-analysis")).toContainText("样本不足");
  await expect(page.getByTestId("survey-enps-analysis")).toContainText("1 个 NPS 回答");
});

test("non-quantitative surveys do not fabricate a zero score", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "开放反馈调研",
      description: "仅包含开放题",
      questions: [
        { title: "请描述你的建议", type: "text", required: true, options: [], category: "开放反馈" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as {
    id: number;
    questions: Array<{ id: number }>;
  };
  expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()).toBe(200);
  expect((await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: { answers: { [survey.questions[0]!.id]: "需要更清晰的交接说明" } },
  })).status()).toBe(201);

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("survey-ai-diagnostic-summary")).toContainText("尚无有效量化维度");
  await expect(page.getByTestId("survey-ai-diagnostic-summary")).not.toContainText("0.0 / 5");
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

test("insight report has mobile navigation without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  const survey = await createSurvey(page);
  expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()).toBe(200);
  const answers = Object.fromEntries(survey.questions.map((question) => {
    if (question.type === "multiple") return [question.id, ["安全"]];
    if (question.type === "rating") return [question.id, 4];
    if (question.type === "nps") return [question.id, 9];
    return [question.id, "移动端开放反馈"];
  }));
  expect((await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } })).status()).toBe(201);
  await page.goto(`/surveys/${survey.id}/results`);

  const mobileNavigation = page.getByTestId("survey-mobile-navigation");
  await expect(mobileNavigation).toBeVisible();
  await expect(page.getByTestId("survey-ai-diagnostic-summary")).toBeVisible();
  const widths = await page.getByTestId("survey-results-scroll").evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  const diagnosticBox = await page.getByTestId("survey-ai-diagnostic-summary").boundingBox();
  expect(diagnosticBox).not.toBeNull();
  expect(diagnosticBox!.x).toBeGreaterThanOrEqual(0);
  expect(diagnosticBox!.x + diagnosticBox!.width).toBeLessThanOrEqual(391);

  await mobileNavigation.getByLabel("问卷导航").selectOption("workspace");
  await expect(page).toHaveURL(/\/surveys\?view=my$/);
});
