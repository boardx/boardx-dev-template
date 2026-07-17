import { expect, test, type APIRequestContext } from "@playwright/test";

test.setTimeout(180_000);

const uniq = (tag: string) =>
  `p27_f07_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function register(request: APIRequestContext, tag: string) {
  const email = uniq(tag);
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
    data: { name: `${tag} Team ${Date.now()}` },
  });
  expect(response.status()).toBe(201);
  return Number((await response.json()).team.id);
}

async function createApprovedResource(
  creator: APIRequestContext,
  admin: APIRequestContext,
  type: "agent" | "skill" | "template",
  tag: string,
) {
  const response = await creator.post("/api/ai-store/items", {
    data: {
      type,
      skillKind: type === "skill" ? "text" : undefined,
      scope: "platform",
      action: "submit_review",
      name: `${tag} ${type} ${Date.now()}`,
      description: `${type} version one`,
      config: `${type} instructions`,
    },
  });
  expect(response.status()).toBe(201);
  const item = (await response.json()).item as { id: number; version: number; name: string };
  const approvedResponse = await admin.post(`/api/admin/ai-store/${item.id}/review`, {
    data: { action: "approve" },
  });
  expect(approvedResponse.status()).toBe(200);
  const approved = (await approvedResponse.json()).item as { version: number };
  return { ...item, version: approved.version };
}

test("USER and TEAM subscriptions are role-gated, Team-scoped, inherited, and independently removable", async ({
  page,
  browser,
  playwright,
  baseURL,
}) => {
  const creator = await playwright.request.newContext({ baseURL });
  await register(creator, "Creator");
  await createTeam(creator, "Creator");

  const adminEmail = await register(page.request, "BoardXAdmin");
  await createTeam(page.request, "BoardXAdmin");
  expect((await page.request.post("/api/dev/grant-sysadmin", {
    data: { email: adminEmail },
  })).status()).toBe(200);

  const resources = await Promise.all([
    createApprovedResource(creator, page.request, "agent", "Shared"),
    createApprovedResource(creator, page.request, "skill", "Shared"),
    createApprovedResource(creator, page.request, "template", "Shared"),
  ]);
  const agent = resources[0];

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const owner = ownerPage.request;
  await register(owner, "ConsumerOwner");
  const consumerTeamId = await createTeam(owner, "Consumer");

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  const member = memberPage.request;
  const memberEmail = await register(member, "ConsumerMember");
  expect((await owner.post("/api/teams/invite", {
    data: { teamId: consumerTeamId, email: memberEmail },
  })).status()).toBe(200);
  expect((await member.post("/api/teams/current", {
    data: { teamId: consumerTeamId },
  })).status()).toBe(200);

  const forbiddenTeamSubscribe = await member.post(`/api/ai-store/items/${agent.id}/subscribe`, {
    data: { scope: "team" },
  });
  expect(forbiddenTeamSubscribe.status()).toBe(403);

  for (const resource of resources) {
    const subscribed = await owner.post(`/api/ai-store/items/${resource.id}/subscribe`, {
      data: { scope: "team" },
    });
    expect(subscribed.status()).toBe(201);
    expect((await owner.post(`/api/ai-store/items/${resource.id}/subscribe`, {
      data: { scope: "team" },
    })).status()).toBe(200);
  }

  const inherited = await member.get("/api/ai-store/items?subscribed=me");
  expect(inherited.status()).toBe(200);
  const inheritedItems = (await inherited.json()).items as Array<{
    id: number | string;
    type: string;
    subscriptionScopes: string[];
  }>;
  expect(inheritedItems.filter((item) => resources.some((resource) => String(resource.id) === String(item.id))))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "agent", subscriptionScopes: ["team"] }),
      expect.objectContaining({ type: "skill", subscriptionScopes: ["team"] }),
      expect.objectContaining({ type: "template", subscriptionScopes: ["team"] }),
    ]));

  const memberStatus = await member.get(`/api/ai-store/items/${agent.id}/subscribe`);
  expect(memberStatus.status()).toBe(200);
  expect(await memberStatus.json()).toMatchObject({
    subscribed: true,
    personal: false,
    team: true,
    canManageTeam: false,
  });

  await ownerPage.goto("/ai-store");
  await ownerPage.getByTestId("store-search").fill(agent.name);
  await ownerPage.getByTestId("store-search").press("Enter");
  await ownerPage.getByTestId("item-grid").locator(`article:has-text("${agent.name}")`).click();
  await expect(ownerPage.getByTestId("detail-subscribe-team")).toBeVisible();
  await expect(ownerPage.getByTestId("detail-subscribe-team")).toContainText("Unsubscribe for team");
  await expect(ownerPage.getByTestId("detail-subscribe")).toContainText("Subscribe for me");
  await ownerPage.getByTestId("close-detail").click();

  await memberPage.goto("/ai-store");
  await memberPage.getByTestId("nav-subscribe").click();
  for (const resource of resources) {
    const card = memberPage.getByTestId(`subscribed-item-${resource.id}`);
    await expect(card).toBeVisible();
    await expect(memberPage.getByTestId(`subscribed-scopes-${resource.id}`)).toContainText("Team");
  }
  await memberPage.getByTestId(`subscribed-use-${resources[0].id}`).click();
  await expect(memberPage).toHaveURL(new RegExp(`/ava\\?agentItemId=${resources[0].id}$`));

  await memberPage.goto("/ai-store?nav=subscribe");
  await memberPage.getByTestId("nav-subscribe").click();
  await memberPage.getByTestId(`subscribed-use-${resources[1].id}`).click();
  await expect(memberPage).toHaveURL(new RegExp(`/ava\\?toolItemId=${resources[1].id}$`));

  await memberPage.goto("/ai-store?nav=subscribe");
  await memberPage.getByTestId("nav-subscribe").click();
  await memberPage.getByTestId(`subscribed-use-${resources[2].id}`).click();
  await expect(memberPage).toHaveURL(/\/boards$/);
  await expect(memberPage.getByTestId("template-use-notice")).toBeVisible();

  expect((await member.post(`/api/ai-store/items/${agent.id}/subscribe`, {
    data: { scope: "personal" },
  })).status()).toBe(201);
  expect(await (await member.get(`/api/ai-store/items/${agent.id}/subscribe`)).json()).toMatchObject({
    personal: true,
    team: true,
  });

  expect((await member.delete(`/api/ai-store/items/${agent.id}/subscribe?scope=personal`)).status()).toBe(200);
  expect(await (await member.get(`/api/ai-store/items/${agent.id}/subscribe`)).json()).toMatchObject({
    subscribed: true,
    personal: false,
    team: true,
  });

  const edit = await creator.patch(`/api/ai-store/items/${agent.id}`, {
    data: {
      type: "agent",
      scope: "platform",
      action: "draft",
      expectedVersion: agent.version,
      name: agent.name,
      description: "agent version two is live",
      config: "latest agent instructions",
    },
  });
  expect(edit.status()).toBe(200);
  const latestInherited = (await (await member.get("/api/ai-store/items?subscribed=me")).json()).items as Array<{
    id: number | string;
    description: string;
  }>;
  expect(latestInherited.find((item) => String(item.id) === String(agent.id))?.description)
    .toBe("agent version two is live");

  const outsiderTeamId = await createTeam(member, "Outsider");
  expect(outsiderTeamId).not.toBe(consumerTeamId);
  const isolated = (await (await member.get("/api/ai-store/items?subscribed=me")).json()).items as Array<{
    id: number | string;
  }>;
  expect(isolated.some((item) => String(item.id) === String(agent.id))).toBe(false);

  expect((await member.post("/api/teams/current", {
    data: { teamId: consumerTeamId },
  })).status()).toBe(200);
  for (const resource of resources) {
    expect((await owner.delete(`/api/ai-store/items/${resource.id}/subscribe?scope=team`)).status()).toBe(200);
  }
  const afterTeamRemoval = (await (await member.get("/api/ai-store/items?subscribed=me")).json()).items as Array<{
    id: number | string;
  }>;
  expect(afterTeamRemoval.some((item) => resources.some((resource) => String(resource.id) === String(item.id))))
    .toBe(false);

  await creator.dispose();
  await ownerContext.close();
  await memberContext.close();
});
