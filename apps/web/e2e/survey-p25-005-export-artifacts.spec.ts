import { expect, test } from "@playwright/test";

test("results render charts and export a protected CSV", async ({ page }) => {
  const email = `p25_export_${Date.now()}@example.com`;
  expect((await page.request.post("/api/auth/register", {
    data: { firstName: "Export", lastName: "Tester", email, password: "secret123", agreeTerms: true },
  })).status()).toBe(201);
  const created = await page.request.post("/api/surveys", { data: {
    title: "导出验收问卷", description: "chart and export",
    questions: [
      { title: "满意度", type: "rating", required: true, options: [] },
      { title: "建议", type: "text", required: false, options: [] },
    ],
  } });
  expect(created.status()).toBe(201);
  const survey = (await created.json()).survey as { id: number; questions: Array<{ id: number }> };
  expect((await page.request.patch(`/api/surveys/${survey.id}`, { data: { isActive: true } })).status()).toBe(200);
  expect((await page.request.post(`/api/surveys/${survey.id}/responses`, { data: { answers: {
    [survey.questions[0]!.id]: 4,
    [survey.questions[1]!.id]: "=HYPERLINK(\"https://invalid.example\",\"x\")",
  } } })).status()).toBe(201);

  const csv = await page.request.get(`/api/surveys/${survey.id}/results/export`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("'=HYPERLINK");

  await page.goto(`/surveys/${survey.id}/results`);
  await expect(page.getByTestId("echat-summary-charts")).toBeVisible();
  await expect(page.getByTestId("export-csv")).toBeVisible();
  await expect(page.getByTestId("export-pdf")).toContainText("导出 PDF");
});
