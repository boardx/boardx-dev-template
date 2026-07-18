import { expect, test, type Browser, type Page } from "@playwright/test";

test.setTimeout(180_000);

const uniq = (tag: string) =>
  `p27_f04_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function register(page: Page, tag: string) {
  const res = await page.request.post("/api/auth/register", {
    data: {
      firstName: tag,
      lastName: "Editor",
      email: uniq(tag),
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function createTeam(page: Page, name: string) {
  const res = await page.request.post("/api/teams", { data: { name } });
  expect(res.status()).toBe(201);
}

async function openUser(browser: Browser, tag: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await register(page, tag);
  await createTeam(page, `${tag} Team ${Date.now()}`);
  return { context, page };
}

test("authoring preview, authorized live edit, source-Team protection, and owner archive", async ({
  page,
  browser,
}) => {
  await register(page, "Owner");
  await createTeam(page, `Owner Team ${Date.now()}`);

  await page.goto("/ai-store");
  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId("creator-preview")).toContainText("Agent");
  await page.getByTestId("creator-type-template").click();
  await expect(page.getByTestId("creator-preview")).toContainText("Template");
  await page.getByTestId("creator-type-skill").click();
  await expect(page.getByTestId("skill-kind-text")).toBeVisible();
  await page.getByTestId("skill-kind-image").click();
  await expect(page.getByTestId("skill-kind-image")).toHaveAttribute("aria-pressed", "true");

  const name = `Image Skill ${Date.now()}`;
  await page.getByTestId("field-name").fill(name);
  await page.getByTestId("field-description").fill("Creates release artwork from a product brief.");
  await page.getByTestId("field-config").fill("Render a clear product image with a transparent background.");
  await expect(page.getByTestId("creator-preview")).toContainText(name);
  await expect(page.getByTestId("creator-preview")).toContainText("Image Skill");

  const createResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/ai-store/items") && res.request().method() === "POST",
  );
  await page.getByTestId("action-publish").click();
  const created = await createResponse;
  expect(created.status()).toBe(201);
  const item = (await created.json()).item as {
    id: number;
    version: number;
    origin_team_id: number;
    config: { skillKind: string };
  };
  const originTeamId = Number(item.origin_team_id);
  expect(Number(item.origin_team_id)).toBe(originTeamId);
  expect(item.config.skillKind).toBe("image");

  const forged = await page.request.patch(`/api/ai-store/items/${item.id}`, {
    data: {
      type: "skill",
      skillKind: "image",
      scope: "personal",
      action: "draft",
      expectedVersion: item.version,
      originTeamId: originTeamId + 99999,
      name,
      description: "Owner edit ignores forged source Team.",
      config: "Updated owner instructions.",
    },
  });
  expect(forged.ok()).toBeTruthy();
  const forgedItem = (await forged.json()).item as { version: number; origin_team_id: number };
  expect(Number(forgedItem.origin_team_id)).toBe(originTeamId);

  const share = await page.request.post(`/api/ai-store/items/${item.id}/share`);
  expect(share.ok()).toBeTruthy();
  const shareToken = (await share.json()).share.share_token as string;
  const shareUrl = `/ai-store/share/${item.id}?shareToken=${encodeURIComponent(shareToken)}`;

  const collaborator = await openUser(browser, "Collaborator");
  await collaborator.page.goto(shareUrl);
  await expect(collaborator.page.getByTestId("authorized-view")).toBeVisible();
  await collaborator.page.getByTestId(`authorized-edit-item-${item.id}`).click();
  await collaborator.page.getByTestId("field-description").fill("Edited live by an authorized Team B user.");
  await collaborator.page.getByTestId("action-save-draft").click();
  await expect(collaborator.page.getByTestId("saved")).toContainText("草稿已保存");

  const updated = await page.request.get(`/api/ai-store/items/${item.id}`);
  expect(updated.ok()).toBeTruthy();
  const updatedItem = (await updated.json()).item as {
    description: string;
    status: string;
    origin_team_id: number;
  };
  expect(updatedItem.description).toBe("Edited live by an authorized Team B user.");
  expect(updatedItem.status).toBe("published");
  expect(Number(updatedItem.origin_team_id)).toBe(originTeamId);

  const intruder = await openUser(browser, "Intruder");
  const denied = await intruder.page.request.patch(`/api/ai-store/items/${item.id}`, {
    data: {
      type: "skill",
      skillKind: "image",
      scope: "personal",
      action: "draft",
      expectedVersion: forgedItem.version + 1,
      name,
      description: "Unauthorized edit",
      config: "Unauthorized instructions",
    },
  });
  expect(denied.status()).toBe(403);
  const deniedArchive = await collaborator.page.request.delete(`/api/ai-store/items/${item.id}`);
  expect(deniedArchive.status()).toBe(403);

  const subscribe = await collaborator.page.request.post(`/api/ai-store/items/${item.id}/subscribe`, {
    data: { scope: "personal" },
  });
  expect(subscribe.ok()).toBeTruthy();

  const archive = await page.request.delete(`/api/ai-store/items/${item.id}`);
  expect(archive.ok()).toBeTruthy();
  await page.reload();
  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId(`owner-item-${item.id}`)).toHaveCount(0);

  const subscribedAfterArchive = await collaborator.page.request.get(
    "/api/ai-store/items?subscribed=me",
  );
  expect(subscribedAfterArchive.ok()).toBeTruthy();
  const subscribedData = (await subscribedAfterArchive.json()) as {
    items: Array<{ id: number; unavailable: boolean }>;
  };
  expect(
    subscribedData.items.some(
      (subscribedItem) =>
        String(subscribedItem.id) === String(item.id) && subscribedItem.unavailable,
    ),
  ).toBeTruthy();

  await collaborator.page.reload();
  await collaborator.page.getByTestId("nav-subscribe").click();
  const unavailable = collaborator.page.getByTestId(`subscribed-item-${item.id}`);
  await expect(unavailable).toContainText("Unavailable");
  await expect(collaborator.page.getByTestId(`subscribed-use-${item.id}`)).toBeDisabled();

  await expect((await page.request.get(`/api/ai-store/items/${item.id}`)).status()).toBe(404);

  await collaborator.context.close();
  await intruder.context.close();
});
