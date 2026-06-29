import { test, expect } from "@playwright/test";

const uniq = () => `ps_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("设置 AI 模型 + 默认隐私并读回", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/account?section=settings");
  await expect(page.getByTestId("ai-model")).toHaveValue("claude-opus-4-8"); // 等加载完成
  await page.getByTestId("ai-model").selectOption("claude-sonnet-4-6");
  await page.getByTestId("default-privacy").selectOption("team");
  await expect(page.getByTestId("default-privacy")).toHaveValue("team");
  await page.getByTestId("save-settings").click();
  await expect(page.getByTestId("saved-settings")).toBeVisible();

  const s = (await (await page.request.get("/api/profile/settings")).json()).settings;
  expect(s.aiModel).toBe("claude-sonnet-4-6");
  expect(s.defaultPrivacy).toBe("team");
});

test("非法 AI 模型被拒（API）", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.put("/api/profile/settings", { data: { aiModel: "gpt-x", defaultPrivacy: "private" } });
  expect(res.status()).toBe(400);
});
