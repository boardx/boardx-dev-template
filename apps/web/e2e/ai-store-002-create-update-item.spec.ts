import { test, expect } from "@playwright/test";

const uniq = () => `as2_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  expect((await page.request.post("/api/auth/register", {
    data: { firstName: "Creator", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  })).status()).toBe(201);
  expect((await page.request.post("/api/teams", {
    data: { name: `Creator Test Team ${Date.now()}` },
  })).status()).toBe(201);
}

test("创建器必填校验、草稿/发布/提交审核、Authorized 编辑自己的项目", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");

  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId("create-view")).toBeVisible();
  await expect(page.getByTestId("creator-type-agent")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("err-name")).toContainText("名称不能为空");
  await expect(page.getByTestId("err-description")).toContainText("描述不能为空");
  await expect(page.getByTestId("err-config")).toContainText("配置不能为空");

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const draftName = `Research Creator ${suffix}`;
  await page.getByTestId("field-name").fill(draftName);
  await page.getByTestId("field-description").fill("Turns customer interviews into research briefs.");
  await page.getByTestId("field-config").fill("Ask for context, extract themes, and draft cited findings.");
  await page.getByTestId("field-cover").fill("R");
  await page.getByTestId("field-tags").fill("research, productivity");
  await page.getByTestId("field-examples").fill("Analyze a user interview, Draft a discovery brief");

  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("saved")).toContainText("草稿已保存");
  const draftCard = page.getByTestId("owner-items").locator(`article:has-text("${draftName}")`);
  await expect(draftCard).toContainText("DRAFT");

  await page.getByTestId("field-scope").selectOption("personal");
  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("已发布");
  await expect(draftCard).toContainText("PUBLISHED");

  const publicList = await page.request.get(`/api/ai-store/items?q=${encodeURIComponent(draftName)}`);
  expect(publicList.status()).toBe(200);
  const publicData = await publicList.json();
  expect(publicData.items.some((item: { name: string; status: string; scope: string }) => (
    item.name === draftName && item.status === "published" && item.scope === "personal"
  ))).toBeTruthy();

  const reviewName = `Template Review ${suffix}`;
  await page.getByTestId("new-item").click();
  await page.getByTestId("creator-type-template").click();
  await expect(page.getByTestId("creator-type-template")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("field-name").fill(reviewName);
  await page.getByTestId("field-description").fill("Reusable workshop board for product teams.");
  await page.getByTestId("field-config").fill("Create sections for goals, risks, ideas, and next steps.");
  await page.getByTestId("field-scope").selectOption("platform");
  await page.getByTestId("action-submit-review").click();
  await expect(page.getByTestId("saved")).toContainText("PENDING");
  const reviewCard = page.getByTestId("owner-items").locator(`article:has-text("${reviewName}")`);
  await expect(reviewCard).toContainText("PENDING");

  await page.getByTestId("nav-authorized").click();
  await expect(page.getByTestId("authorized-view")).toBeVisible();
  await expect(page.getByTestId("owner-items")).toContainText(draftName);
  await expect(page.getByTestId("owner-items")).toContainText(reviewName);

  await page.getByTestId("owner-items").locator(`article:has-text("${draftName}")`).getByText("Edit").click();
  await expect(page.getByTestId("create-view")).toBeVisible();
  await page.getByTestId("field-description").fill("Updated research assistant for customer discovery.");
  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("saved")).toContainText("草稿已保存");
  await expect(page.getByTestId("owner-items").locator(`article:has-text("${draftName}")`)).toContainText("PUBLISHED");

  const owned = await page.request.get("/api/ai-store/items?owner=me");
  expect(owned.status()).toBe(200);
  const ownedData = await owned.json();
  expect(ownedData.items.some((item: { name: string; status: string; description: string }) => (
    item.name === draftName &&
    item.status === "published" &&
    item.description === "Updated research assistant for customer discovery."
  ))).toBeTruthy();
  expect(ownedData.items.some((item: { name: string; status: string; scope: string }) => (
    item.name === reviewName && item.status === "pending" && item.scope === "platform"
  ))).toBeTruthy();
});
