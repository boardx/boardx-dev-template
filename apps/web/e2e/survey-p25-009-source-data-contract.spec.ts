import { expect, test, type Page } from "@playwright/test";

async function register(page: Page, prefix: string) {
  const response = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Survey",
      lastName: "F09",
      email: `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createAndSelectTeam(page: Page) {
  const created = await page.request.post("/api/teams", { data: { name: `Survey F09 ${Date.now()}` } });
  expect(created.status()).toBe(201);
  const teamId = (await created.json()).team.id as number;
  expect((await page.request.post("/api/teams/current", { data: { teamId } })).status()).toBe(200);
}

test("source question, template, and report contracts persist across requests", async ({ page }) => {
  await register(page, "p25_f09_owner");
  await createAndSelectTeam(page);
  const created = await page.request.post("/api/surveys", {
    data: {
      title: "商品安全数据契约",
      questions: [
        {
          title: "你最关注哪些安全信息？",
          type: "multiple",
          required: true,
          options: ["成分", "认证"],
          category: "商品安全",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number; questions: Array<{ category: string }> };
  expect(survey.questions[0]?.category).toBe("商品安全");

  const templateCreated = await page.request.post("/api/survey-templates", {
    data: {
      name: "安全模板",
      title: "安全模板",
      description: "分类模板",
      tags: ["商品安全", "市场研究", "商品安全"],
      questions: [
        {
          title: "安全问题",
          type: "text",
          required: true,
          options: [],
          category: "商品安全",
        },
      ],
    },
  });
  expect(templateCreated.status()).toBe(201);
  expect((await templateCreated.json()).template.tags).toEqual(["商品安全", "市场研究"]);

  const reportTemplateSaved = await page.request.patch(`/api/surveys/${survey.id}/report-template`, {
    data: {
      title: "商品安全报告",
      sections: ["样本概览", "安全洞察"],
      metrics: ["response_count"],
      chartSlots: ["安全关注分布"],
      caveats: ["小样本仅供参考"],
    },
  });
  expect(reportTemplateSaved.status()).toBe(200);

  const reportCategoriesSaved = await page.request.patch(`/api/surveys/${survey.id}/report-categories`, {
    data: {
      title: "商品安全专业报告",
      description: "按业务分类生成",
      categories: [
        {
          name: "商品安全",
          questionIds: [1],
          inputModes: ["chart", "text"],
          chartType: "bar",
          chartStyle: "business",
          prompt: "输出安全关注点和行动建议",
        },
      ],
    },
  });
  expect(reportCategoriesSaved.status()).toBe(200);

  const surveyReloaded = await page.request.get(`/api/surveys/${survey.id}`);
  expect(surveyReloaded.status()).toBe(200);
  expect((await surveyReloaded.json()).survey.questions[0]?.category).toBe("商品安全");

  const templatesReloaded = await page.request.get("/api/survey-templates");
  expect(templatesReloaded.status()).toBe(200);
  const templates = (await templatesReloaded.json()).templates as Array<{ title: string; tags: string[] }>;
  expect(templates.find((item) => item.title === "安全模板")?.tags).toEqual(["商品安全", "市场研究"]);

  const reportTemplateReloaded = await page.request.get(`/api/surveys/${survey.id}/report-template`);
  expect(reportTemplateReloaded.status()).toBe(200);
  expect((await reportTemplateReloaded.json()).reportTemplate.title).toBe("商品安全报告");

  const reportCategoriesReloaded = await page.request.get(`/api/surveys/${survey.id}/report-categories`);
  expect(reportCategoriesReloaded.status()).toBe(200);
  expect((await reportCategoriesReloaded.json()).reportCategoryPlan.categories[0]).toMatchObject({
    name: "商品安全",
    chartType: "bar",
    chartStyle: "business",
  });

  await register(page, "p25_f09_outsider");
  for (const path of ["report-template", "report-categories"]) {
    expect((await page.request.get(`/api/surveys/${survey.id}/${path}`)).status()).toBe(403);
    expect((await page.request.patch(`/api/surveys/${survey.id}/${path}`, { data: {} })).status()).toBe(403);
  }
});
