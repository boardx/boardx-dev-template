import { expect, test, type Page } from "@playwright/test";

test.setTimeout(300_000);

const suffix = () => `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

async function setupUniqueTeam(page: Page) {
  const id = suffix();
  const register = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Recovery",
      lastName: "Owner",
      email: `p27_f15_${id}@example.com`,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(register.status()).toBe(201);

  const teamResponse = await page.request.post("/api/teams", {
    data: { name: `AI Store Recovery ${id}` },
  });
  expect(teamResponse.status()).toBe(201);
  const team = (await teamResponse.json()).team as { id: number; name: string };

  const itemResponse = await page.request.post("/api/ai-store/items", {
    data: {
      type: "skill",
      scope: "team",
      action: "publish",
      name: `Recovery Skill ${id}`,
      description: "Validates current Team recovery and the approved Resource Library layout.",
      config: "Use the active Team context.",
      skillKind: "text",
      tags: ["research"],
      allowCopy: true,
    },
  });
  expect(itemResponse.status()).toBe(201);
  const item = (await itemResponse.json()).item as { id: number; name: string };

  await page.context().clearCookies({ name: "boardx_current_team" });
  return { team, item };
}

test("recovers a unique Team before loading resources and matches the approved desktop catalog", async ({
  page,
}, testInfo) => {
  const { team, item } = await setupUniqueTeam(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  const itemResponses: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/ai-store/items?") && response.request().method() === "GET") {
      itemResponses.push(response.status());
    }
  });

  await page.goto("/ai-store");
  await expect(page.getByTestId("resource-library-team")).toHaveText(team.name);
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId(`item-source-team-${item.id}`)).toHaveText(team.name);
  expect(itemResponses.length).toBeGreaterThan(0);
  expect(itemResponses.every((status) => status === 200)).toBe(true);

  const navigation = page.getByTestId("store-submenu");
  await expect(navigation).toBeVisible();
  const navigationBox = await navigation.boundingBox();
  expect(navigationBox?.width).toBeGreaterThanOrEqual(200);
  expect(navigationBox?.height).toBeGreaterThanOrEqual(700);

  await expect(page.getByTestId("approved-design-toolbar")).toBeVisible();
  for (const control of [
    "filter-type",
    "filter-source-team",
    "filter-version",
    "filter-subscription",
    "filter-tags",
    "filter-featured",
    "sort-resources",
  ]) {
    await expect(page.getByTestId(control)).toBeVisible();
  }

  for (const column of [
    "resource-column-name",
    "resource-column-type",
    "resource-column-source",
    "resource-column-version",
    "resource-column-subscription",
    "resource-column-updated",
  ]) {
    await expect(page.getByTestId(column)).toBeVisible();
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath("approved-resource-library-1280.png"), fullPage: true });

  await page.setViewportSize({ width: 1490, height: 1060 });
  await page.screenshot({ path: testInfo.outputPath("approved-resource-library-reference-size.png"), fullPage: true });
});
