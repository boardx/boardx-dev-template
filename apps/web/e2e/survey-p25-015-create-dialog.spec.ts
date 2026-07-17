import { expect, test, type Locator, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "Dialog",
      email: `p25_f15_dialog_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function openCreateDialog(page: Page) {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await expect(page.getByTestId("new-survey-dialog")).toBeVisible();
}

async function contentFits(locator: Locator) {
  return locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    whiteSpace: window.getComputedStyle(element).whiteSpace,
  }));
}

test("create chooser presents three readable decisions with clear actions", async ({ page }) => {
  await page.setViewportSize({ width: 1624, height: 934 });
  await openCreateDialog(page);

  const dialog = page.getByTestId("new-survey-dialog");
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.width).toBeGreaterThanOrEqual(680);

  await expect(page.getByTestId("new-survey-ai-recommended")).toHaveText("推荐");
  await expect(page.getByTestId("new-survey-ai-action")).toHaveText("开始对话");
  await expect(page.getByTestId("new-survey-template-action")).toHaveText("浏览模板");
  await expect(page.getByTestId("new-survey-blank-action")).toHaveText("从空白开始");
  await expect(page.getByTestId("new-survey-ai")).toBeFocused();

  for (const testId of ["new-survey-ai", "new-survey-template", "new-survey-blank"]) {
    const metrics = await contentFits(page.getByTestId(testId));
    expect(metrics.whiteSpace).toBe("normal");
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  }

  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-13/evidence/survey-create-dialog-f15-desktop.png",
  });
});

test("create chooser stacks inside a mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCreateDialog(page);

  const dialog = page.getByTestId("new-survey-dialog");
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);

  const optionIds = ["new-survey-ai", "new-survey-template", "new-survey-blank"];
  const optionBoxes = [];
  for (const testId of optionIds) {
    const option = page.getByTestId(testId);
    await option.scrollIntoViewIfNeeded();
    await expect(option).toBeVisible();
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    optionBoxes.push(box!);
    const metrics = await contentFits(option);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  }

  expect(Math.max(...optionBoxes.map((box) => box.x)) - Math.min(...optionBoxes.map((box) => box.x))).toBeLessThanOrEqual(1);

  const documentWidths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(documentWidths.scrollWidth).toBeLessThanOrEqual(documentWidths.clientWidth + 1);
});
