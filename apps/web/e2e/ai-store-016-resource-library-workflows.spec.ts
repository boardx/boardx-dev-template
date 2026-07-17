import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.setTimeout(300_000);

const suffix = () => `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

async function register(request: APIRequestContext, prefix: string) {
  const email = `${prefix}_${suffix()}@example.com`;
  const response = await request.post("/api/auth/register", {
    data: {
      firstName: prefix,
      lastName: "Owner",
      email,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
  return email;
}

async function createTeam(request: APIRequestContext, prefix: string) {
  const response = await request.post("/api/teams", {
    data: { name: `${prefix} ${suffix()}` },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).team as { id: number; name: string };
}

async function createPublishedResource(request: APIRequestContext, name: string) {
  const response = await request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "personal",
      action: "publish",
      name,
      description: "Source description for a confirmed independent copy.",
      config: "Use the current Team context.",
      tags: ["research"],
      allowCopy: true,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: number; name: string };
}

async function openCreatedEditor(page: Page, itemId: number) {
  await page.getByTestId("nav-created").click();
  await expect(page.getByTestId(`owner-item-${itemId}`)).toBeVisible();
  await page.getByTestId(`edit-item-${itemId}`).click();
  await expect(page.getByTestId("resource-editor")).toBeVisible();
}

test("Resource editor previews, persists live published changes, and keeps unsaved content on 409", async ({
  page,
}, testInfo) => {
  await register(page.request, "Workflow");
  const team = await createTeam(page.request, "Workflow Team");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ai-store");

  await page.getByTestId("create-resource").click();
  await expect(page.getByTestId("resource-editor")).toBeVisible();
  await expect(page.getByTestId("editor-current-team")).toHaveText(team.name);
  await expect(page.getByTestId("creator-type-agent")).toBeVisible();
  await expect(page.getByTestId("creator-type-skill")).toBeVisible();
  await expect(page.getByTestId("creator-type-template")).toBeVisible();

  const name = `Workflow Agent ${suffix()}`;
  await page.getByTestId("field-name").fill(name);
  await page.getByTestId("field-description").fill("Version one description");
  await page.getByTestId("field-config").fill("Version one instructions");
  await page.getByTestId("field-allow-copy").check();
  await expect(page.getByTestId("editor-unsaved")).toBeVisible();
  await expect(page.getByTestId("preview-name")).toHaveText(name);
  await expect(page.getByTestId("preview-description")).toHaveText("Version one description");
  await expect(page.getByTestId("owner-items").getByTestId("loading")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("resource-editor-1280.png"), fullPage: true });

  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("saved")).toContainText("Draft saved");
  await expect(page.getByTestId("editor-unsaved")).toHaveCount(0);

  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("Published");
  const itemId = Number(await page.getByTestId("editor-item-id").getAttribute("data-item-id"));
  expect(itemId).toBeGreaterThan(0);

  await openCreatedEditor(page, itemId);
  await page.getByTestId("field-description").fill("Unsaved conflict description");
  await page.route(`**/api/ai-store/items/${itemId}`, async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "Version conflict" }),
    });
  }, { times: 1 });
  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("editor-state-409")).toBeVisible();
  await expect(page.getByTestId("field-description")).toHaveValue("Unsaved conflict description");
  await expect(page.getByTestId("editor-unsaved")).toBeVisible();

  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("saved")).toContainText("live for existing subscribers");
  await expect(page.getByTestId("editor-unsaved")).toHaveCount(0);

  await expect(page.getByTestId(`share-item-${itemId}`)).toBeVisible();
  await page.getByTestId(`share-item-${itemId}`).click();
  await expect(page.getByTestId("share-modal")).toBeVisible();
  await page.getByTestId("share-copy-link").click();
  await expect(page.getByTestId("share-status")).toHaveText("SHARED");
  await expect(page.getByTestId("share-link")).toBeVisible();
});

test("Copy confirmation names the target Team and opens an independent draft", async ({ page }, testInfo) => {
  await register(page.request, "CopyFlow");
  const team = await createTeam(page.request, "Copy Target");
  const item = await createPublishedResource(page.request, `Copy Source ${suffix()}`);

  await page.goto(`/ai-store?q=${encodeURIComponent(item.name)}`);
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible();
  await page.getByTestId(`item-${item.id}`).click();
  await page.getByTestId("detail-copy").click();

  await expect(page.getByTestId("copy-resource-dialog")).toBeVisible();
  await expect(page.getByTestId("copy-target-team")).toHaveText(team.name);
  await expect(page.getByTestId("copy-independence-note")).toContainText("will not follow future updates");
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath("copy-resource-dialog-1280.png"), fullPage: true });
  await page.getByTestId("confirm-copy-resource").click();

  await expect(page.getByTestId("resource-editor")).toBeVisible();
  await expect(page.getByTestId("saved")).toContainText("independent draft");
  await expect(page.getByTestId("editor-current-team")).toHaveText(team.name);
  await expect(page.getByTestId("field-name")).toHaveValue(/Copy/);
});

test("role-gated review destinations use the shared Resource Library review workspace", async ({
  page,
}, testInfo) => {
  const email = await register(page.request, "Reviewer");
  const team = await createTeam(page.request, "Review Team");
  await page.goto("/ai-store");

  await page.getByTestId("nav-team-review").click();
  await expect(page).toHaveURL(new RegExp(`/teams/${team.id}/ai-store-review`));
  await expect(page.getByTestId("review-workspace")).toBeVisible();
  await expect(page.getByTestId("review-scope")).toHaveText("Team review");

  expect((await page.request.post("/api/dev/grant-sysadmin", { data: { email } })).status()).toBe(200);
  await page.goto("/ai-store");
  await expect(page.getByTestId("nav-boardx-review")).toBeVisible();
  await page.getByTestId("nav-boardx-review").click();
  await expect(page).toHaveURL(/\/admin\/ai-store\/review/);
  await expect(page.getByTestId("review-workspace")).toBeVisible();
  await expect(page.getByTestId("review-scope")).toHaveText("BoardX review");
  await page.screenshot({ path: testInfo.outputPath("boardx-review-1280.png"), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
