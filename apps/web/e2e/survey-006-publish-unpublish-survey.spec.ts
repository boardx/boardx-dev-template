import { test, expect, type Page } from "@playwright/test";

// uc-survey-006-publish-unpublish-survey — 发布/暂停问卷（公开答题开关）。
// F06 覆盖：卡片 Pause/Activate 即时切换 PATCH /api/surveys/:id {isActive}；
// active 时公开答题链接可正常填答（含提交落库），paused/未发布时公开页展示
// 「暂不接受答题」且提交被拒；无权限者（非 owner）不能切换状态。
// 依赖 F01（创建问卷）/F03（公开答题门控，见 f03-06-answer-privacy-security-followup.txt
// 修复的 info-disclosure：paused 问卷公开 API 不得泄露题目/选项）。

const uniq = () => `sv6_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function register(page: Page, prefix = "survey6") {
  const email = `${prefix}_${uniq()}@ex.com`;
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "Six", email, password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function createSurvey(page: Page, title: string) {
  const res = await page.request.post("/api/surveys", {
    data: {
      title,
      description: "Publish/pause gate survey",
      questions: [{ title: "Any feedback?", type: "text", required: true, options: [] }],
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).survey as { id: number; shareUrl: string };
}

test("owner 通过卡片切换发布状态，即时反映在卡片标签", async ({ page }) => {
  await register(page, "owner6");
  const title = `Toggle Card ${uniq()}`;
  const survey = await createSurvey(page, title);

  await page.goto("/surveys");
  await expect(page.getByTestId(`survey-status-${survey.id}`)).toHaveText("Paused");
  await expect(page.getByTestId(`survey-toggle-${survey.id}`)).toContainText("Activate");

  await page.getByTestId(`survey-toggle-${survey.id}`).click();
  await expect(page.getByTestId(`survey-status-${survey.id}`)).toHaveText("Active");
  await expect(page.getByTestId(`survey-toggle-${survey.id}`)).toContainText("Pause");

  await page.getByTestId(`survey-toggle-${survey.id}`).click();
  await expect(page.getByTestId(`survey-status-${survey.id}`)).toHaveText("Paused");
  await expect(page.getByTestId(`survey-toggle-${survey.id}`)).toContainText("Activate");
});

test("active 时公开答题链接可正常填答并提交；paused 时公开页拒答且提交被拒绝", async ({ page }) => {
  await register(page, "publisher");
  const title = `Publish Gate ${uniq()}`;
  const survey = await createSurvey(page, title);

  // 激活：PATCH isActive=true
  const activateRes = await page.request.patch(`/api/surveys/${survey.id}`, {
    data: { isActive: true },
  });
  expect(activateRes.status()).toBe(200);
  expect((await activateRes.json()).survey.status).toBe("active");

  await page.context().clearCookies();
  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("survey-answer-title")).toHaveText(title);
  await expect(page.getByTestId("survey-answer-form")).toBeVisible();

  const answerRes = await page.request.get(`/api/surveys/${survey.id}/answer`);
  expect((await answerRes.json()).survey.questions.length).toBe(1);

  const questionId = (await answerRes.json()).survey.questions[0].id;
  const submitRes = await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: { answers: { [String(questionId)]: "Great tool." } },
  });
  expect(submitRes.status()).toBe(201);
});

test("owner 暂停问卷后：公开页展示不可答题态，提交被 409 拒绝，且不泄露题目内容", async ({ page }) => {
  await register(page, "pauser");
  const title = `Pause Gate ${uniq()}`;
  const survey = await createSurvey(page, title);

  // 先激活，确认地址曾经可答
  await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } });
  const beforePause = await page.request.get(`/api/surveys/${survey.id}/answer`);
  expect((await beforePause.json()).survey.questions.length).toBe(1);

  // 再暂停：isActive=false 应立刻关闭公开答题入口
  const pauseRes = await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: false } });
  expect(pauseRes.status()).toBe(200);
  expect((await pauseRes.json()).survey.status).toBe("paused");

  await page.context().clearCookies();

  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("survey-unavailable")).toBeVisible();
  await expect(page.getByTestId("survey-unavailable")).toContainText(title);
  await expect(page.getByTestId("err-unavailable")).toContainText("not accepting responses");
  await expect(page.getByTestId("survey-answer-form")).toHaveCount(0);

  // API 层校验：paused 问卷不返回题目内容（避免遍历 id 泄露），提交路径 409。
  const answerRes = await page.request.get(`/api/surveys/${survey.id}/answer`);
  expect(answerRes.status()).toBe(200);
  const answerBody = await answerRes.json();
  expect(answerBody.survey.isActive).toBe(false);
  expect(answerBody.survey.questions).toEqual([]);

  const submitRes = await page.request.post(`/api/surveys/${survey.id}/responses`, {
    data: { answers: { "1": "should be rejected" } },
  });
  expect(submitRes.status()).toBe(409);
});

test("非 owner 不能切换问卷发布状态（PATCH 返回 403，状态不变）", async ({ page }) => {
  await register(page, "realowner");
  const title = `Guarded ${uniq()}`;
  const survey = await createSurvey(page, title);

  await page.context().clearCookies();
  await register(page, "intruder");

  const forbidden = await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } });
  expect(forbidden.status()).toBe(403);

  // 状态确实没变：公开答题页仍是未发布态。
  await page.goto(survey.shareUrl);
  await expect(page.getByTestId("survey-unavailable")).toBeVisible();

  // 非 owner 在列表里看不到 Toggle 按钮（卡片对非 owner 隐藏该操作）。
  await page.goto("/surveys");
  await expect(page.getByTestId(`survey-${survey.id}`)).toHaveCount(0);
});
