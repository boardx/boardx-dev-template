import { expect, test, type Page } from "@playwright/test";

const uniq = () => `sv14_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
}

test("user creates a categorized survey from a built-in template", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await expect(page.getByTestId("survey-diagnostic-home")).toBeVisible();
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-template").click();

  const templateGrid = page.getByTestId("diagnostic-template-grid");
  await expect(templateGrid).toBeVisible();
  const templateCard = templateGrid.locator('[data-testid^="template-card-"]').first();
  await expect(templateCard).toContainText("系统");
  await templateCard.getByTestId(/use-template-/).click();

  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("question-title-0")).not.toHaveValue("");
});

test("new homepage chooser opens the AI survey workflow", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("new-survey-ai").click();

  await expect(page.getByTestId("survey-editor-shell")).toBeVisible();
  await expect(page.getByTestId("survey-ai-assistant")).toBeVisible();
  await expect(page.getByTestId("ai-input")).toBeVisible();
});

test("Survey navigation reaches the current workspace and template center", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await expect(page.getByTestId("survey-source-sidebar")).toBeVisible();

  await page.getByTestId("survey-nav-workspace").click();
  await expect(page.getByTestId("empty").or(page.getByTestId("survey-list"))).toBeVisible();

  await page.getByTestId("survey-nav-templates").click();
  await expect(page.getByTestId("diagnostic-template-center")).toBeVisible();
});

test("report workflow keeps the zero-response limitation visible", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "零样本商品安全调研",
      description: "Report template zero response test",
      questions: [
        {
          title: "你最关注哪些安全信息？",
          type: "multiple",
          required: true,
          options: ["成分", "认证", "生产日期"],
        },
      ],
      reportTemplate: {
        title: "零样本商品安全调研报告",
        sections: ["样本概览", "安全关注点", "行动建议"],
        metrics: ["response_count", "safety_concern_distribution"],
        chartSlots: ["安全关注点条形图"],
        caveats: ["无答卷时只生成分析框架。"],
      },
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number };

  await page.goto(`/surveys?survey=${survey.id}&step=report`);
  await expect(page.getByTestId("professional-report-document")).toContainText("尚无真实答卷", { timeout: 20_000 });
  await expect(page.getByTestId("professional-report-document")).not.toContainText("模拟数据");
});

test("survey list preserves publish settings and identified one-response gate", async ({ page }) => {
  await register(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "实名一人一答调研",
      description: "Publish settings list and response gate test",
      questions: [
        {
          title: "你是否愿意参与后续访谈？",
          type: "single",
          required: true,
          options: ["愿意", "暂不考虑"],
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number; questions: Array<{ id: number }> };

  const patched = await page.request.patch(`/api/surveys/${survey.id}`, {
    data: {
      isActive: true,
      responseMode: "identified",
      oneResponsePerUser: true,
      responseLimit: 5,
      confirmationMessage: "已收到实名答卷。",
    },
  });
  expect(patched.status()).toBe(200);

  const listed = await page.request.get("/api/surveys");
  expect(listed.status()).toBe(200);
  const listBody = await listed.json();
  const listedSurvey = listBody.surveys.find((item: { id: number }) => item.id === survey.id);
  expect(listedSurvey).toMatchObject({
    responseMode: "identified",
    oneResponsePerUser: true,
    responseLimit: 5,
    confirmationMessage: "已收到实名答卷。",
  });

  const answers = { [survey.questions[0]!.id]: "愿意" };
  const first = await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } });
  expect(first.status()).toBe(201);

  const second = await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers } });
  expect(second.status()).toBe(409);
  expect(await second.json()).toMatchObject({ error: "你已提交过该问卷" });
});
