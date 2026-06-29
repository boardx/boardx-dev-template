import { test, expect } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("创建团队后出现在列表且自己是 owner", async ({ page }) => {
  const email = uniq("tc");
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  await page.goto("/teams");
  await page.getByTestId("team-name").fill("Acme Team");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("team-list")).toContainText("Acme Team");
  await expect(page.getByTestId("team-list")).toContainText("owner");
});

test("空团队名被拒", async ({ page }) => {
  const email = uniq("tc");
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/teams", { data: { name: "  " } });
  expect(res.status()).toBe(400);
});
