import { test, expect, type Page } from "@playwright/test";

// uc-survey-002-list-manage-surveys — My/Team Surveys 列表卡片 + 管理操作。
// 只覆盖列表管理边界：状态切换/删除/分享/预览/结果占位；公开答题与报告留给后续 feature。

const uniq = () => `sv2_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function register(page: Page, prefix = "survey") {
  const email = `${prefix}_${uniq()}@ex.com`;
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "S", lastName: "V", email, password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  return email;
}

async function createSurvey(
  page: Page,
  input: { title: string; description?: string; scope?: "private" | "team"; teamId?: number }
) {
  const res = await page.request.post("/api/surveys", {
    data: {
      title: input.title,
      description: input.description ?? "List management survey",
      scope: input.scope ?? "private",
      teamId: input.teamId,
      questions: [{ title: "How satisfied are you?", type: "rating", required: true }],
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).survey as { id: number; shareUrl: string };
}

test("空态：新用户进入 /surveys 后可创建第一个问卷", async ({ page }) => {
  await register(page, "empty");
  await page.goto("/surveys");
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("empty-new-survey")).toBeVisible();
});

test("My surveys 卡片展示字段，并支持 View/Edit/Preview/Share/Activate/Pause/Delete", async ({ page }) => {
  await register(page, "owner");
  const originalTitle = `Owner Pulse ${uniq()}`;
  const survey = await createSurvey(page, { title: originalTitle });

  await page.goto("/surveys");
  await expect(page.getByTestId(`survey-${survey.id}`)).toBeVisible();
  await expect(page.getByTestId(`survey-title-${survey.id}`)).toHaveText(originalTitle);
  await expect(page.getByTestId(`survey-scope-${survey.id}`)).toHaveText("Private");
  await expect(page.getByTestId(`survey-responses-${survey.id}`)).toHaveText("0");
  await expect(page.getByTestId(`survey-updated-${survey.id}`)).toContainText("Updated");
  await expect(page.getByTestId(`survey-status-${survey.id}`)).toHaveText("Paused");

  await page.getByTestId(`survey-view-${survey.id}`).click();
  await expect(page.getByTestId(`survey-results-${survey.id}`)).toContainText("0 responses collected");

  await page.getByTestId(`survey-share-${survey.id}`).click();
  await expect(page.getByTestId(`survey-share-panel-${survey.id}`)).toContainText(`/survey/${survey.id}/answer`);

  await page.getByTestId(`survey-preview-${survey.id}`).click();
  await expect(page.getByTestId("survey-preview")).toContainText(originalTitle);
  await expect(page.getByTestId("survey-preview")).toContainText("How satisfied are you?");
  await page.getByTestId("back-to-list").click();

  await page.getByTestId(`survey-toggle-${survey.id}`).click();
  await expect(page.getByTestId(`survey-status-${survey.id}`)).toHaveText("Active");
  await page.getByTestId(`survey-toggle-${survey.id}`).click();
  await expect(page.getByTestId(`survey-status-${survey.id}`)).toHaveText("Paused");

  await page.getByTestId(`survey-edit-${survey.id}`).click();
  const editedTitle = `Edited Pulse ${uniq()}`;
  await page.getByTestId("survey-title").fill(editedTitle);
  await page.getByTestId("save-survey").click();
  await expect(page.getByTestId(`survey-title-${survey.id}`)).toHaveText(editedTitle);

  await page.getByTestId(`survey-delete-${survey.id}`).click();
  await expect(page.getByTestId(`survey-delete-confirm-${survey.id}`)).toBeVisible();
  await page.getByTestId(`survey-delete-confirm-button-${survey.id}`).click();
  await expect(page.getByTestId(`survey-${survey.id}`)).toHaveCount(0);
});

test("Team surveys 只显示当前团队上下文内且有权限的问卷", async ({ page }) => {
  await register(page, "team-owner");
  const team = (await (await page.request.post("/api/teams", { data: { name: `Survey Team ${uniq()}` } })).json()).team as {
    id: number;
  };
  const teamTitle = `Team Visible ${uniq()}`;
  const survey = await createSurvey(page, { title: teamTitle, scope: "team", teamId: team.id });

  await page.goto("/surveys");
  await page.getByTestId("filter-team-surveys").click();
  await expect(page.getByTestId(`survey-${survey.id}`)).toBeVisible();
  await expect(page.getByTestId(`survey-scope-${survey.id}`)).toHaveText("Team");

  await page.context().clearCookies();
  await register(page, "outsider");
  const apiRes = await page.request.get("/api/surveys");
  expect(apiRes.status()).toBe(200);
  expect(JSON.stringify(await apiRes.json())).not.toContain(teamTitle);

  await page.goto("/surveys");
  await expect(page.getByTestId("empty")).toBeVisible();
  const forbiddenDelete = await page.request.delete(`/api/surveys/${survey.id}`);
  expect(forbiddenDelete.status()).toBe(403);
});
