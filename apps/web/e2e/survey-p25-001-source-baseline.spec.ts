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
  await page.getByTestId("empty-new-survey").click();
  await expect(page.getByTestId("template-library")).toBeVisible();
  await expect(page.getByTestId("template-product-safety-research")).toBeVisible();
  await expect(page.getByTestId("template-category-product-safety-research")).toContainText("product_safety");
  await page.getByTestId("template-product-safety-research").click();
  await expect(page.getByTestId("survey-title")).toHaveValue("商品安全市场调研问卷");
  await expect(page.getByTestId("question-title-0")).toHaveValue("你的年龄段是？");
  await expect(page.getByTestId("question-category-0")).toContainText("demographics");
});

test("AI creates a categorized draft from pasted reference content with report template", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await page.getByTestId("ai-model").selectOption("mock-survey-fast");
  await page.getByTestId("ai-input").fill(
    [
      "我要做一个商品安全市场调研。",
      "参考内容：用户最担心成分、认证、生产日期和品牌责任。",
      "请生成一份问卷，并绑定报告模板。",
    ].join("\n")
  );
  await page.getByTestId("ai-send").click();
  await expect(page.getByTestId("ai-draft-preview")).toBeVisible();
  await expect(page.getByTestId("ai-draft-markdown")).toContainText("分类：");
  await expect(page.getByTestId("ai-draft-markdown")).toContainText("报告模板");
  await expect(page.getByTestId("ai-draft-markdown")).toContainText("图表");
});

test("Survey workbench separates personal, team, template, and AI entry points", async ({ page }) => {
  await register(page);
  await page.goto("/surveys");
  await expect(page.getByTestId("survey-workbench-tabs")).toBeVisible();

  await page.getByTestId("tab-my-surveys").click();
  await expect(page.getByTestId("empty").or(page.getByTestId("survey-list"))).toBeVisible();

  await page.getByTestId("tab-team-surveys").click();
  await expect(page.getByTestId("team-surveys-empty").or(page.getByTestId("survey-list"))).toBeVisible();

  await page.getByTestId("tab-survey-templates").click();
  await expect(page.getByTestId("templates-workbench")).toBeVisible();
  await expect(page.getByTestId("workbench-template-product-safety-research")).toBeVisible();

  await page.getByTestId("tab-ai-create").click();
  await expect(page.getByTestId("ai-create-workbench")).toBeVisible();
  await expect(page.getByTestId("create-with-ai")).toBeVisible();
});

test("AI report uses report template and handles zero responses", async ({ page }) => {
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

  await page.goto(`/surveys/${survey.id}/results`);
  await page.getByTestId("tab-report").click();
  await expect(page.getByTestId("report-template-panel")).toBeVisible();
  await expect(page.getByTestId("report-template-title")).toContainText("零样本商品安全调研");
  await expect(page.getByTestId("report-template-sections")).toContainText("样本概览");
  await expect(page.getByTestId("report-template-sections")).toContainText("关键指标");

  await page.getByTestId("report-model").selectOption("mock-survey-quality");
  await page.getByTestId("generate-ai-report").click();
  await expect(page.getByTestId("report-panel")).toContainText("暂无答卷", { timeout: 20_000 });
  await expect(page.getByTestId("report-panel")).toContainText("仅提供分析框架", { timeout: 20_000 });
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
