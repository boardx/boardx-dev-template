import { expect, test, type Page } from "@playwright/test";

const uniq = () => `p27_f03_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function register(page: Page) {
  const res = await page.request.post("/api/auth/register", {
    data: {
      firstName: "Explore",
      lastName: "Owner",
      email: uniq(),
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(res.ok()).toBeTruthy();
}

async function createTeam(page: Page, name: string) {
  const res = await page.request.post("/api/teams", { data: { name } });
  expect(res.status()).toBe(201);
  return (await res.json()).team.id as number;
}

async function switchTeam(page: Page, teamId: number) {
  const res = await page.request.post("/api/teams/current", { data: { teamId } });
  expect(res.ok()).toBeTruthy();
}

async function createItem(page: Page, input: {
  type: "agent" | "image-tool" | "template";
  name: string;
  description?: string;
  tags?: string;
}) {
  const res = await page.request.post("/api/ai-store/items", {
    data: {
      type: input.type,
      skillKind: input.type === "image-tool" ? "image" : undefined,
      scope: "personal",
      action: "publish",
      name: input.name,
      description: input.description ?? `${input.name} description`,
      config: `${input.name} instructions`,
      tags: input.tags ?? "research",
      examples: `${input.name} example`,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).item as { id: number; version: number; type: string };
}

test("Explore is Team-aware and exposes Agent, Skills, Template detail and pagination", async ({ page }) => {
  await register(page);
  const teamA = await createTeam(page, `Explore Team A ${Date.now()}`);

  const agent = await createItem(page, {
    type: "agent",
    name: "Team A Research Agent",
  });
  const skill = await createItem(page, {
    type: "image-tool",
    name: "Team A Image Skill",
    tags: "design",
  });
  await createItem(page, {
    type: "template",
    name: "Team A Workshop Template",
  });
  for (let i = 0; i < 8; i += 1) {
    await createItem(page, {
      type: "agent",
      name: `Team A Agent ${String(i + 1).padStart(2, "0")}`,
    });
  }

  const teamB = await createTeam(page, `Explore Team B ${Date.now()}`);
  await createItem(page, {
    type: "agent",
    name: "Team B Private Agent",
  });

  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toContainText("Team B Private Agent");
  await expect(page.getByTestId("item-grid")).not.toContainText("Team A Research Agent");

  await switchTeam(page, teamA);
  await page.reload();

  await expect(page.getByTestId("store-submenu")).toBeVisible();
  await expect(page.getByTestId("nav-explore")).toBeVisible();
  await expect(page.getByTestId("nav-subscribe")).toBeVisible();
  await expect(page.getByTestId("nav-create")).toBeVisible();
  await expect(page.getByTestId("nav-authorized")).toBeVisible();
  await expect(page.getByTestId("nav-shared")).toBeVisible();

  await expect(page.getByTestId("type-agent")).toBeVisible();
  await expect(page.getByTestId("type-skill")).toHaveText("Skills");
  await expect(page.getByTestId("type-template")).toBeVisible();
  await expect(page.getByTestId("type-ai-tool")).toHaveCount(0);
  await expect(page.getByTestId("type-image-tool")).toHaveCount(0);

  await expect(page.getByTestId("result-count")).toContainText("11");
  await expect(page.getByTestId("pagination")).toBeVisible();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 1 / 2");
  await page.getByTestId("page-next").click();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 2 / 2");
  await page.getByTestId("page-prev").click();

  await page.getByTestId("type-skill").click();
  await expect(page.getByTestId("item-grid")).toContainText("Team A Image Skill");
  await expect(page.getByTestId("item-grid")).not.toContainText("Team A Research Agent");

  await page.getByTestId("type-all").click();
  await page.getByTestId("store-search").fill("Research Agent");
  await page.getByTestId("store-search").press("Enter");
  await expect(page.getByTestId(`item-${agent.id}`)).toBeVisible();
  await page.getByTestId(`item-${agent.id}`).click();

  const modal = page.getByTestId("item-detail-modal");
  await expect(modal.getByTestId("detail-name")).toHaveText("Team A Research Agent");
  await expect(modal.getByTestId("detail-source-team")).toHaveText(`Team #${teamA}`);
  await expect(modal.getByTestId("detail-version")).toHaveText(`Version ${agent.version}`);
  await expect(modal.getByTestId("detail-description")).toBeVisible();
  await expect(modal.getByTestId("detail-examples")).toBeVisible();
  await modal.getByTestId("close-detail").click();

  expect(skill.type).toBe("skill");
  expect(teamB).not.toBe(teamA);
});

test("Explore request failure has a stable error and retry state", async ({ page }) => {
  await register(page);
  await createTeam(page, `Explore Retry Team ${Date.now()}`);

  let failed = false;
  await page.route("**/api/ai-store/items?*", async (route) => {
    const url = new URL(route.request().url());
    if (!failed && url.searchParams.has("page") && !url.searchParams.has("subscribed")) {
      failed = true;
      await route.fulfill({ status: 500, json: { error: "forced failure" } });
      return;
    }
    await route.continue();
  });

  await page.goto("/ai-store");
  await expect(page.getByTestId("error")).toBeVisible();
  await expect(page.getByTestId("retry")).toBeVisible();
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("empty")).toBeVisible();
});
