import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.setTimeout(300_000);

const suffix = () => `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

async function register(request: APIRequestContext, tag: string) {
  const email = `p27_f16_${tag}_${suffix()}@example.com`;
  const response = await request.post("/api/auth/register", {
    data: {
      firstName: tag,
      lastName: "User",
      email,
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
  return email;
}

async function createTeam(request: APIRequestContext, tag: string) {
  const response = await request.post("/api/teams", {
    data: { name: `${tag} Team ${suffix()}` },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).team as { id: number; name: string };
}

async function createPublishedAgent(request: APIRequestContext, name: string) {
  const response = await request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "personal",
      action: "publish",
      name,
      description: "A browser acceptance resource with a stable subscription state.",
      config: "Use the current Team context.",
      tags: ["research"],
      allowCopy: true,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: number; name: string };
}

test("direct Explore URLs preserve the real subscription and source Team context", async ({ page }) => {
  await register(page.request, "Catalog");
  const team = await createTeam(page.request, "Catalog");
  const target = await createPublishedAgent(page.request, `Exact URL Agent ${suffix()}`);
  await createPublishedAgent(page.request, `Unrelated Agent ${suffix()}`);
  expect((await page.request.post(`/api/ai-store/items/${target.id}/subscribe`, {
    data: { scope: "personal" },
  })).status()).toBe(201);

  await page.goto(`/ai-store?q=${encodeURIComponent(target.name)}`);

  await expect(page.getByTestId("store-search")).toHaveValue(target.name);
  await expect(page.getByTestId(`item-${target.id}`)).toBeVisible();
  await expect(page.getByTestId("item-grid").locator('article[data-testid^="item-"]')).toHaveCount(1);
  await expect(page.getByTestId(`item-subscribe-${target.id}`)).toHaveText("Open");
  await expect(page.getByTestId(`item-source-team-${target.id}`)).toHaveText(team.name);
  await expect(page.getByTestId("nav-shared")).toContainText("Shared by me");

  await page.getByTestId(`item-${target.id}`).click();
  await expect(page.getByTestId("detail-source-team")).toHaveText(team.name);
  await page.getByTestId("close-detail").click();

  await page.getByTestId("nav-subscribe").click();
  await page.route(`**/api/ai-store/items/${target.id}/use`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Deliberate acceptance failure" }),
    });
  }, { times: 1 });
  await page.getByTestId(`subscribed-use-${target.id}`).click();
  await expect(page.getByTestId("subscribe-view-error")).toHaveText("Deliberate acceptance failure");
  await page.getByTestId("nav-shared").click();
  await page.getByTestId("nav-subscribe").click();
  await expect(page.getByTestId("subscribe-view-error")).toHaveCount(0);
});

test("Template authoring requires a real source Board and Use deep-copies its content", async ({ page }) => {
  await register(page.request, "Template");
  const team = await createTeam(page.request, "Template");
  const roomResponse = await page.request.post("/api/rooms", {
    data: { name: `Template Room ${suffix()}`, visibility: "team", teamId: team.id },
  });
  expect(roomResponse.status()).toBe(201);
  const roomId = Number((await roomResponse.json()).room.id);
  const boardName = `Template Source Board ${suffix()}`;
  const boardResponse = await page.request.post(`/api/rooms/${roomId}/boards`, {
    data: { name: boardName },
  });
  expect(boardResponse.status()).toBe(201);
  const boardId = Number((await boardResponse.json()).board.id);
  expect((await page.request.post(`/api/boards/${boardId}/items`, {
    data: { type: "note", x: 24, y: 32, text: "Browser acceptance template content" },
  })).status()).toBe(201);

  await page.goto("/ai-store");
  await page.getByTestId("create-resource").click();
  await page.getByTestId("creator-type-template").click();
  await expect(page.getByTestId("field-template-board")).toBeVisible();
  await expect(page.getByTestId("field-template-board").locator(`option[value="${boardId}"]`)).toHaveText(boardName);

  const templateName = `Executable Template ${suffix()}`;
  await page.getByTestId("field-name").fill(templateName);
  await page.getByTestId("field-description").fill("Creates a real independent Board in the subscriber Team.");
  await page.getByTestId("field-config").fill("Preserve the source Board structure and content.");
  await page.getByTestId("field-template-board").selectOption(String(boardId));
  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("Published");
  const itemId = Number(await page.getByTestId("editor-item-id").getAttribute("data-item-id"));

  expect((await page.request.post(`/api/ai-store/items/${itemId}/subscribe`, {
    data: { scope: "personal" },
  })).status()).toBe(201);
  await page.goto(`/ai-store?q=${encodeURIComponent(templateName)}`);
  await expect(page.getByTestId(`item-use-${itemId}`)).toBeVisible();
  const useResponse = page.waitForResponse(
    (response) => response.url().endsWith(`/api/ai-store/items/${itemId}/use`)
      && response.request().method() === "POST",
  );
  await page.getByTestId(`item-use-${itemId}`).click();
  const used = await useResponse;
  expect([200, 201]).toContain(used.status());
  const result = await used.json() as { board: { id: number; public_id: string } };
  await expect(page).toHaveURL(new RegExp(`/boards/${result.board.public_id}$`));
  const copiedItems = await (await page.request.get(`/api/boards/${result.board.id}/items`)).json();
  expect(copiedItems.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: "Browser acceptance template content" }),
  ]));
});

test("authorized editing keeps the inbound source Team context", async ({ page, playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await register(owner, "SourceOwner");
  const sourceTeam = await createTeam(owner, "Source");
  const item = await createPublishedAgent(owner, `Authorized Agent ${suffix()}`);
  const shareResponse = await owner.post(`/api/ai-store/items/${item.id}/share`);
  expect(shareResponse.status()).toBe(201);
  const shareToken = String((await shareResponse.json()).share.share_token);

  await register(page.request, "AuthorizedEditor");
  await createTeam(page.request, "Consumer");
  expect((await page.request.post(
    `/api/ai-store/items/${item.id}/share/redeem?shareToken=${encodeURIComponent(shareToken)}`,
  )).status()).toBe(200);

  await page.goto("/ai-store?view=authorized");
  await expect(page.getByTestId(`authorized-item-${item.id}`)).toBeVisible();
  await page.getByTestId(`authorized-edit-item-${item.id}`).click();
  await expect(page.getByTestId("resource-editor")).toBeVisible();
  await expect(page.getByTestId("nav-authorized")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("editor-current-team")).toHaveText(sourceTeam.name);

  await page.getByTestId("field-description").fill("Authorized changes are live immediately.");
  await page.getByTestId("action-save-draft").click();
  await expect(page.getByTestId("saved")).toHaveText(
    "Changes are live for existing subscribers. 更改已实时生效",
  );
  await owner.dispose();
});
