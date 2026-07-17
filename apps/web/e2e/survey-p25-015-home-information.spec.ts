import { expect, test, type Page } from "@playwright/test";

async function register(page: Page) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F15",
      email: `p25_f15_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createSurvey(page: Page, title: string) {
  const response = await page.request.post("/api/surveys", {
    data: {
      title,
      description: `${title} 的诊断说明`,
      questions: [
        {
          title: "目前最需要解决的问题是什么？",
          type: "text",
          required: true,
          options: [],
          category: "开放反馈",
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).survey as { id: number };
}

test("home removes the organization and consultant community cards", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");

  await expect(page.getByTestId("survey-home-metrics")).toBeVisible();
  await expect(page.getByTestId("survey-home-organization")).toHaveCount(0);
  await expect(page.getByTestId("survey-home-community")).toHaveCount(0);
});

test("my surveys navigation shows the exact owner survey count", async ({ page }) => {
  await register(page);
  for (let index = 1; index <= 10; index += 1) {
    await createSurvey(page, `问卷数量 ${index}`);
  }

  await page.goto("/surveys");

  await expect(page.getByTestId("survey-nav-workspace-count")).toHaveText("10");
  await expect(page.getByTestId("survey-nav-workspace-count")).toHaveAttribute("aria-label", "10 份问卷");
});

test("recent surveys distinguish scheduled publication from an unpublished draft", async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 996 });
  await register(page);
  const draft = await createSurvey(page, "尚未发布的诊断问卷");
  const scheduled = await createSurvey(page, "已安排发布的诊断问卷");
  const publishStartAt = "2026-07-10T08:30:00.000Z";
  const published = await page.request.patch(`/api/surveys/${scheduled.id}`, {
    data: { isActive: true, publishStartAt },
  });
  expect(published.status()).toBe(200);

  await page.goto("/surveys");

  const scheduledTime = page.getByTestId(`survey-home-published-at-${scheduled.id}`);
  await expect(scheduledTime).toContainText("发布时间");
  await expect(scheduledTime).toContainText(/2026.*07.*10/);
  await expect(scheduledTime).not.toContainText("尚未发布");
  await expect(page.getByTestId(`survey-home-published-at-${draft.id}`)).toHaveText("尚未发布");
  await page.screenshot({
    path: "../../phases/phase-p25-survey/sprints/sprint-13/evidence/survey-home-f15-desktop.png",
    fullPage: true,
  });
});

test("recent survey publication details do not create mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await register(page);
  const survey = await createSurvey(page, "移动端发布时间问卷");
  expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()).toBe(200);

  await page.goto("/surveys");

  await expect(page.getByTestId(`survey-home-published-at-${survey.id}`)).toBeVisible();
  const widths = await page.getByTestId("survey-diagnostic-home").evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
