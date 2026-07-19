import { expect, test, type ElementHandle, type Page } from "@playwright/test";

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

type ShellSnapshot = {
  header: ElementHandle<HTMLElement>;
  tabs: ElementHandle<HTMLElement>;
  headerText: string;
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
    headerText: await header!.textContent() ?? "",
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
  await expect(page.getByTestId("survey-workflow-header")).toHaveText(snapshot.headerText);
  const headerBox = await page.getByTestId("survey-workflow-header").boundingBox();
  const tabsBox = await page.getByTestId("survey-workflow-tabs").boundingBox();
  expect(headerBox).toEqual(snapshot.headerBox);
  expect(tabsBox).toEqual(snapshot.tabsBox);
}

test("workflow tabs keep one persistent shell and only replace content below", async ({ page }) => {
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
    await expect(page.getByTestId(contentTestId)).toBeVisible({ timeout: 20_000 });
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
