import { expect, test } from "@playwright/test";

test.setTimeout(300_000);

async function setup(page: import("@playwright/test").Page) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  expect((await page.request.post("/api/auth/register", { data: {
    firstName: "Library", lastName: "Owner", email: `p27_f13_${suffix}@example.com`,
    password: "secret123", agreeTerms: true,
  } })).status()).toBe(201);
  const teamResponse = await page.request.post("/api/teams", {
    data: { name: `Resource Library ${suffix}` },
  });
  expect(teamResponse.status()).toBe(201);
  const team = (await teamResponse.json()).team as { id: number; name: string };
  const resourceResponse = await page.request.post("/api/ai-store/items", { data: {
    type: "agent", scope: "personal", action: "publish",
    name: `Library Agent ${suffix}`,
    description: "A focused resource for validating the Resource Library workspace.",
    config: "Answer with the current Team context.",
    tags: ["research"], allowCopy: true,
  } });
  expect(resourceResponse.status()).toBe(201);
  return { team, item: (await resourceResponse.json()).item as { id: number; name: string } };
}

test("Resource Library provides role-aware navigation, URL-backed catalog, and retained detail context", async ({ page }, testInfo) => {
  const { team, item } = await setup(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ai-store");

  await expect(page.getByTestId("resource-library-workspace")).toBeVisible();
  await expect(page.getByTestId("resource-library-team")).toContainText(team.name);
  for (const destination of [
    "explore", "featured", "subscriptions", "created", "authorized", "shared", "team-review",
  ]) {
    await expect(page.getByTestId(`nav-${destination}`)).toBeVisible();
  }
  await expect(page.getByTestId("nav-boardx-review")).toHaveCount(0);
  await expect(page.getByTestId("create-resource")).toBeVisible();
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("resource-table")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("resource-library-1280.png"), fullPage: true });

  await page.getByTestId("store-search").fill(item.name);
  await page.getByTestId("store-search").press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(item.name).replace(/%20/g, "(?:%20|\\+)")}`));
  const row = page.getByTestId(`item-${item.id}`);
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId("resource-detail-panel")).toBeVisible();
  await expect(page.getByTestId("detail-name")).toHaveText(item.name);
  await expect(page.getByTestId("resource-table")).toBeVisible();
  const detailBox = await page.getByTestId("item-detail-modal").boundingBox();
  expect(detailBox?.width).toBeGreaterThanOrEqual(440);
  expect(detailBox?.width).toBeLessThanOrEqual(500);
  await page.screenshot({ path: testInfo.outputPath("resource-library-detail-1280.png"), fullPage: true });
  await page.getByTestId("close-detail").click();

  await page.getByTestId("type-skill").click();
  await expect(page).toHaveURL(/type=skill/);
  await page.getByTestId("nav-featured").click();
  await expect(page).toHaveURL(/view=featured/);
  await expect(page.getByTestId("resource-catalog")).toBeVisible();

  await page.getByTestId("nav-explore").click();
  await page.getByTestId("type-all").click();
  await page.getByTestId("store-search").fill(item.name);
  await page.getByTestId("store-search").press("Enter");
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible({ timeout: 30_000 });

  await page.setViewportSize({ width: 768, height: 900 });
  const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(tabletOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("resource-library-768.png"), fullPage: true });
});

test("Resource Library uses a mobile list, has no horizontal overflow, and keeps 410 local to detail", async ({ page }, testInfo) => {
  const { item } = await setup(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/ai-store?q=${encodeURIComponent(item.name)}`);

  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("resource-mobile-list")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("resource-library-375.png"), fullPage: true });

  await page.route(`**/api/ai-store/items/${item.id}`, async (route) => {
    await route.fulfill({ status: 410, contentType: "application/json", body: JSON.stringify({ error: "资源已撤回" }) });
  });
  await page.getByTestId(`item-${item.id}`).click();
  await expect(page.getByTestId("detail-state-410")).toBeVisible();
  await expect(page.getByTestId("resource-mobile-list")).toBeVisible();
});
