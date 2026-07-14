import { expect, test } from "@playwright/test";

test("AI draft session is private and can be resumed", async ({ page }) => {
  const email = `p25_session_${Date.now()}@example.com`;
  expect((await page.request.post("/api/auth/register", { data: {
    firstName: "Session", lastName: "Owner", email, password: "secret123", agreeTerms: true,
  } })).status()).toBe(201);
  const generated = await page.request.post("/api/surveys/ai", { data: {
    model: "mock-survey-fast", mode: "create_survey", command: "生成一份商品体验问卷",
  } });
  expect(generated.status()).toBe(200);
  const payload = await generated.json() as { sessionId: string; draft: { title: string } };

  const sessions = await page.request.get("/api/surveys/ai/sessions?kind=create_survey&status=open&limit=1");
  expect(sessions.status()).toBe(200);
  expect((await sessions.json()).sessions[0].id).toBe(payload.sessionId);
  const bundle = await page.request.get(`/api/surveys/ai/sessions/${payload.sessionId}`);
  expect(bundle.status()).toBe(200);
  expect((await bundle.json()).drafts[0].draft.title).toBe(payload.draft.title);

  await page.goto("/surveys");
  await page.getByTestId("create-with-ai").click();
  await expect(page.getByText(/已恢复上次未完成的 AI 问卷草稿/)).toBeVisible({ timeout: 20_000 });
});
