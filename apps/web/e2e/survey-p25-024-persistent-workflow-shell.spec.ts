import { expect, test, type ElementHandle, type Locator, type Page } from "@playwright/test";
import path from "node:path";

const repositoryRoot = path.resolve(__dirname, "../../..");

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F24",
      email: `p25_f24_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title: "持久壳层问卷",
      description: "验证五步工作流只替换导航下方内容",
      questions: [
        {
          title: "你最关注哪个体验环节？",
          type: "single",
          required: true,
          options: ["设计", "发布", "报告"],
          category: "体验诊断",
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as { id: number };
}

async function tabTo(page: Page, target: Locator, maximumTabs = 80) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let index = 0; index < maximumTabs; index += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => document.activeElement === node)) return;
  }
  throw new Error(`Keyboard focus did not reach ${await target.getAttribute("data-testid")}`);
}

async function waitForScreenshotImages(page: Page) {
  await page.locator("img").evaluateAll(async (images) => {
    await Promise.all(images.map(async (image) => {
      if (!(image instanceof HTMLImageElement)) return;
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      await image.decode().catch(() => undefined);
    }));
  });
}

type ShellSnapshot = {
  header: ElementHandle<HTMLElement>;
  tabs: ElementHandle<HTMLElement>;
  surveyTitle: string;
  headerBox: { x: number; y: number; width: number; height: number };
  tabsBox: { x: number; y: number; width: number; height: number };
};

async function captureShell(page: Page): Promise<ShellSnapshot> {
  const header = await page.getByTestId("survey-workflow-header").elementHandle();
  const tabs = await page.getByTestId("survey-workflow-tabs").elementHandle();
  expect(header).not.toBeNull();
  expect(tabs).not.toBeNull();
  const headerBox = await header!.boundingBox();
  const tabsBox = await tabs!.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(tabsBox).not.toBeNull();
  return {
    header: header! as ElementHandle<HTMLElement>,
    tabs: tabs! as ElementHandle<HTMLElement>,
    surveyTitle: "持久壳层问卷",
    headerBox: headerBox!,
    tabsBox: tabsBox!,
  };
}

async function expectSameShell(page: Page, snapshot: ShellSnapshot) {
  expect(await snapshot.header.evaluate((node) => (
    node.isConnected && node === document.querySelector("[data-testid=survey-workflow-header]")
  ))).toBe(true);
  expect(await snapshot.tabs.evaluate((node) => (
    node.isConnected && node === document.querySelector("[data-testid=survey-workflow-tabs]")
  ))).toBe(true);
  await expect(page.getByTestId("survey-workflow-header")).toContainText(snapshot.surveyTitle);
  const headerBox = await page.getByTestId("survey-workflow-header").boundingBox();
  const tabsBox = await page.getByTestId("survey-workflow-tabs").boundingBox();
  expect(headerBox).toEqual(snapshot.headerBox);
  expect(tabsBox).toEqual(snapshot.tabsBox);
}

test("workflow tabs keep one persistent shell and only replace content below", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1920, height: 1200 });
  await register(page);
  const survey = await createSurvey(page);

  await page.goto(`/surveys?survey=${survey.id}&step=design`);
  await expect(page.getByTestId("survey-editor-screen")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("survey-workflow-header")).toContainText("持久壳层问卷");
  await expect(page.getByTestId("workflow-design")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("survey-workflow-tabs")).toHaveCount(1);
  const shell = await captureShell(page);

  for (const [step, contentTestId] of [
    ["template", "workspace-template-workbench"],
    ["collect", "workspace-collect-workbench"],
    ["answer", "workspace-answer-workbench"],
    ["report", "report-generation-empty-state"],
  ] as const) {
    await page.getByTestId(`workflow-${step}`).click();
    await expect(page).toHaveURL(new RegExp(`survey=${survey.id}.*step=${step}`));
    await expect(page.getByTestId(contentTestId)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`workflow-${step}`)).toHaveAttribute("aria-current", "step");
    await expectSameShell(page, shell);
  }

  await page.reload();
  await expect(page.getByTestId("survey-workflow-header")).toContainText("持久壳层问卷");
  await expect(page.getByTestId("survey-workflow-tabs")).toHaveCount(1);
  await expect(page.getByTestId("workflow-report")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("report-generation-empty-state")).toBeVisible({ timeout: 20_000 });

  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-24/evidence/persistent-workflow-shell.png",
    fullPage: false,
  });
});

test("each workflow deep link uses the shared framed surface and marks its active step", async ({ page }) => {
  await register(page);
  const survey = await createSurvey(page);
  const steps = ["design", "template", "collect", "answer", "report"] as const;

  for (const step of steps) {
    await page.goto(`/surveys?survey=${survey.id}&step=${step}`);
    const surface = page.getByTestId("survey-workflow-surface");
    const content = surface.getByTestId("survey-workflow-content");

    await expect(surface).toHaveCount(1);
    await expect(surface).toBeVisible({ timeout: 20_000 });
    await expect(content).toHaveCount(1);
    await expect(content).toBeVisible();
    await expect(page.getByTestId("survey-workflow-tabs")).toHaveCount(1);
    await expect(page.getByTestId(`survey-workflow-step-${step}`)).toHaveAttribute("data-active", "true");

    for (const inactiveStep of steps.filter((candidate) => candidate !== step)) {
      await expect(page.getByTestId(`survey-workflow-step-${inactiveStep}`)).toHaveAttribute("data-active", "false");
    }

    const overflow = await content.evaluate((node) => ({
      content: node.scrollWidth - node.clientWidth,
      surface: node.parentElement ? node.parentElement.scrollWidth - node.parentElement.clientWidth : 1,
    }));
    expect(overflow.content).toBeLessThanOrEqual(1);
    expect(overflow.surface).toBeLessThanOrEqual(1);
  }
});

test("five workflow surfaces fill the desktop workspace and keep a single-column mobile layout", async ({ page }) => {
  test.setTimeout(120_000);
  await register(page);
  const survey = await createSurvey(page);
  const steps = ["design", "template", "collect", "answer", "report"] as const;
  const workbenches = {
    design: "survey-editor-screen",
    template: "workspace-template-workbench",
    collect: "workspace-collect-workbench",
    answer: "workspace-answer-workbench",
    report: "workspace-report-workbench",
  } as const;
  const mobileCommands = {
    design: page.getByTestId("preview-survey"),
    template: page.getByTestId("template-continue-publish"),
    collect: page.getByTestId("save-collect-settings"),
    answer: page.getByTestId("answer-open-preview"),
  } as const;
  const evidenceRoot = path.join(
    repositoryRoot,
    "phases/phase-p25-survey/sprints/sprint-12/evidence",
  );
  const desktopEvidencePath = `${evidenceRoot}/survey-five-step-unified-desktop.png`;
  const mobileEvidencePath = `${evidenceRoot}/survey-five-step-unified-mobile.png`;
  const desktopScreenshots: string[] = [];
  const mobileScreenshots: string[] = [];
  const renderScreenshotSheet = (screenshots: string[], columns: number) => `
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #f7f4ff; color: #1b1726; font-family: Arial, sans-serif; }
      main { display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: 16px; padding: 16px; }
      figure { margin: 0; overflow: hidden; border: 1px solid #ded6f2; border-radius: 8px; background: #ffffff; }
      figcaption { padding: 10px 12px; font-size: 14px; font-weight: 700; }
      img { display: block; width: 100%; height: auto; }
    </style>
    <main>${screenshots.map((screenshot, index) => `
      <figure>
        <figcaption>${steps[index]}</figcaption>
        <img alt="${steps[index]} workflow surface" src="data:image/png;base64,${screenshot}" />
      </figure>
    `).join("")}</main>
  `;

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const step of steps) {
    await page.goto(`/surveys?survey=${survey.id}&step=${step}`);
    const surface = page.getByTestId("survey-workflow-surface");
    const content = page.getByTestId("survey-workflow-content");
    const header = page.getByTestId("survey-workflow-header");
    const topbar = page.getByTestId("survey-workflow-topbar");
    const tabs = page.getByTestId("survey-workflow-tabs");

    await expect(header).toContainText("持久壳层问卷", { timeout: 30_000 });
    const workbench = page.getByTestId(workbenches[step]);
    await expect(workbench).toBeVisible({ timeout: 20_000 });
    if (step === "design") {
      await expect(page.getByTestId("survey-title")).toHaveValue("持久壳层问卷", { timeout: 30_000 });
      await expect(page.getByTestId("question-title-0")).toHaveValue("你最关注哪个体验环节？", { timeout: 30_000 });
    }
    await expect(surface).toBeVisible({ timeout: 20_000 });
    await expect(content).toBeVisible();
    const [headerBox, topbarBox, tabsBox, surfaceBox, contentBox, workbenchBox] = await Promise.all([
      header.boundingBox(),
      topbar.boundingBox(),
      tabs.boundingBox(),
      surface.boundingBox(),
      content.boundingBox(),
      workbench.boundingBox(),
    ]);
    expect(headerBox).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(tabsBox).not.toBeNull();
    expect(surfaceBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(workbenchBox).not.toBeNull();
    expect(Math.abs(tabsBox!.y - topbarBox!.y - topbarBox!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(surfaceBox!.y - headerBox!.y - headerBox!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(contentBox!.x - surfaceBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(contentBox!.width - surfaceBox!.width)).toBeLessThanOrEqual(1);
    expect(workbenchBox!.x - contentBox!.x).toBeLessThanOrEqual(25);
    expect(contentBox!.x + contentBox!.width - workbenchBox!.x - workbenchBox!.width).toBeLessThanOrEqual(25);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
    desktopScreenshots.push((await page.screenshot({ fullPage: false })).toString("base64"));
  }

  await page.setContent(renderScreenshotSheet(desktopScreenshots, 2));
  await waitForScreenshotImages(page);
  await page.screenshot({
    path: desktopEvidencePath,
    fullPage: true,
  });

  await page.setViewportSize({ width: 375, height: 812 });
  for (const step of steps) {
    await page.goto(`/surveys?survey=${survey.id}&step=${step}`);
    const activeControl = page.getByTestId(`workflow-${step}`);

    await expect(page.getByTestId("survey-workflow-header")).toContainText("持久壳层问卷", { timeout: 30_000 });
    await expect(page.getByTestId(workbenches[step])).toBeVisible({ timeout: 20_000 });
    if (step === "design") {
      await expect(page.getByTestId("survey-title")).toHaveValue("持久壳层问卷", { timeout: 30_000 });
      await expect(page.getByTestId("question-title-0")).toHaveValue("你最关注哪个体验环节？", { timeout: 30_000 });
    }
    await expect(page.getByTestId("survey-workflow-content")).toBeVisible({ timeout: 20_000 });
    await expect(activeControl).toBeVisible();
    await tabTo(page, activeControl);
    await expect(activeControl).toBeFocused();
    if (step === "report") {
      const emptyState = page.getByTestId("report-generation-empty-state");
      await expect(emptyState).toContainText("收到至少 1 份有效答卷后可生成报告");
      await expect(page.getByRole("button", { name: "重新生成" })).toBeDisabled();
    } else {
      const command = mobileCommands[step];
      await tabTo(page, command);
      await expect(command).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.getByTestId("survey-workflow-scroll-container").evaluate((element) => {
      element.scrollTop = 0;
    });
    mobileScreenshots.push((await page.screenshot({ fullPage: false })).toString("base64"));
  }

  await page.setContent(renderScreenshotSheet(mobileScreenshots, 1));
  await waitForScreenshotImages(page);
  await page.screenshot({
    path: mobileEvidencePath,
    fullPage: true,
  });
});

test("simplified collect workspace focuses on status, effective time, and advanced settings", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1487, height: 1058 });
  await register(page);
  const survey = await createSurvey(page);

  await page.goto(`/surveys?survey=${survey.id}&step=collect`);

  const workbench = page.getByTestId("workspace-collect-workbench");
  await expect(workbench).toBeVisible({ timeout: 20_000 });
  await expect(workbench.getByTestId("collect-status-panel")).toBeVisible();
  await expect(workbench.getByTestId("collect-settings-panel")).toBeVisible();
  await expect(workbench.getByTestId("collect-enabled-switch")).toHaveAttribute("role", "switch");
  await expect(workbench.getByTestId("save-collect-settings")).toBeVisible();
  await expect(workbench.getByText("发布 AI", { exact: true })).toHaveCount(0);
  await expect(workbench.getByText("回收监控", { exact: true })).toHaveCount(0);
  await expect(workbench.getByText("报告规划", { exact: true })).toHaveCount(0);
  await page.screenshot({
    path: path.join(
      repositoryRoot,
      "phases/phase-p25-survey/sprints/sprint-12/evidence/survey-collect-simplified-desktop.png",
    ),
    fullPage: false,
  });

  const startImmediately = workbench.getByRole("checkbox", { name: "立即开始" });
  const noEndDate = workbench.getByRole("checkbox", { name: "长期有效" });
  const startInput = workbench.getByLabel("开始时间");
  const endInput = workbench.getByLabel("结束时间");

  await expect(startImmediately).toBeChecked();
  await expect(noEndDate).toBeChecked();
  await expect(startInput).toBeDisabled();
  await expect(endInput).toBeDisabled();

  await startImmediately.uncheck();
  await noEndDate.uncheck();
  await expect(startInput).toBeEnabled();
  await expect(endInput).toBeEnabled();

  await startInput.fill("2026-07-31T10:00");
  await expect(noEndDate).not.toBeChecked();
  await expect(endInput).toBeEnabled();
  await endInput.fill("2026-07-31T09:00");
  await expect(workbench.getByTestId("err-collect-time")).toHaveText("结束时间必须晚于开始时间");
  await expect(workbench.getByTestId("save-collect-settings")).toBeDisabled();

  await endInput.fill("2026-07-31T11:00");
  await expect(workbench.getByTestId("err-collect-time")).toHaveCount(0);
  await expect(workbench.getByTestId("save-collect-settings")).toBeEnabled();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH"
      && response.url().endsWith(`/api/surveys/${survey.id}`),
  );
  await workbench.getByTestId("save-collect-settings").click();
  expect((await saveResponse).ok()).toBe(true);
  await expect(workbench.locator('[role="status"], [role="alert"]')).toHaveText("已保存发布设置");

  const enabledSwitch = workbench.getByTestId("collect-enabled-switch");
  await enabledSwitch.click();
  await expect(enabledSwitch).toHaveAttribute("aria-checked", "true");
  await expect(workbench.getByRole("button", { name: "复制问卷链接" })).toBeEnabled();

  const advanced = workbench.getByTestId("collect-advanced-settings");
  await expect(advanced).not.toHaveAttribute("open", "");
  await advanced.getByText("高级设置", { exact: true }).click();
  await expect(advanced).toHaveAttribute("open", "");
  await expect(workbench.getByLabel("答题身份")).toBeVisible();
  await expect(workbench.getByLabel("答卷上限")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await expect(page.getByTestId("workspace-collect-workbench")).toBeVisible({ timeout: 20_000 });
  const overflow = await page.getByTestId("survey-workflow-content").evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: path.join(
      repositoryRoot,
      "phases/phase-p25-survey/sprints/sprint-12/evidence/survey-collect-simplified-mobile.png",
    ),
    fullPage: false,
  });
});
