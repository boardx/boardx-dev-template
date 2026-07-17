import { expect, test, type APIRequestContext } from "@playwright/test";

test.setTimeout(180_000);

const uniq = (tag: string) =>
  `p27_f09_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

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
  const name = `${tag} Team ${Date.now()}`;
  const response = await request.post("/api/teams", { data: { name } });
  expect(response.status()).toBe(201);
  return { id: Number((await response.json()).team.id), name };
}

async function createResource(
  request: APIRequestContext,
  type: "agent" | "skill" | "template",
  tag: string,
  originTeamId: number,
) {
  let templateBoardId: number | undefined;
  if (type === "template") {
    const roomResponse = await request.post("/api/rooms", {
      data: { name: `${tag} Template Source ${Date.now()}`, visibility: "team", teamId: originTeamId },
    });
    expect(roomResponse.status()).toBe(201);
    const roomId = Number((await roomResponse.json()).room.id);
    const boardResponse = await request.post(`/api/rooms/${roomId}/boards`, {
      data: { name: `${tag} Template Board ${Date.now()}` },
    });
    expect(boardResponse.status()).toBe(201);
    templateBoardId = Number((await boardResponse.json()).board.id);
  }
  const response = await request.post("/api/ai-store/items", {
    data: {
      type,
      skillKind: type === "skill" ? "image" : undefined,
      scope: "personal",
      action: "publish",
      name: `${tag} ${type} ${Date.now()}`,
      description: `${type} shared version one`,
      config: `${type} shared instructions`,
      templateBoardId,
    },
  });
  expect(response.status()).toBe(201);
  const item = (await response.json()).item as {
    id: number;
    type: string;
    scope: string;
    status: string;
    name: string;
    version: number;
    owner_user_id: number;
    origin_team_id: number;
  };
  return {
    ...item,
    id: Number(item.id),
    owner_user_id: Number(item.owner_user_id),
    origin_team_id: Number(item.origin_team_id),
  };
}

test("cross-Team edit sharing preserves ownership, scopes grants to the receiving Team, and revokes immediately", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await register(ownerPage.request, "Owner");
  const originTeam = await createTeam(ownerPage.request, "Origin");

  const resources = await Promise.all([
    createResource(ownerPage.request, "agent", "Shared", originTeam.id),
    createResource(ownerPage.request, "skill", "Shared", originTeam.id),
    createResource(ownerPage.request, "template", "Shared", originTeam.id),
  ]);
  const tokens = new Map<number, string>();
  for (const resource of resources) {
    const response = await ownerPage.request.post(`/api/ai-store/items/${resource.id}/share`);
    expect(response.status()).toBe(201);
    tokens.set(resource.id, (await response.json()).share.share_token as string);
  }

  const collaboratorContext = await browser.newContext();
  const collaboratorPage = await collaboratorContext.newPage();
  await register(collaboratorPage.request, "Collaborator");
  const receivingTeam = await createTeam(collaboratorPage.request, "Receiving");

  for (const resource of resources) {
    const response = await collaboratorPage.request.post(
      `/api/ai-store/items/${resource.id}/share/redeem?shareToken=${encodeURIComponent(tokens.get(resource.id)!)}`,
    );
    expect(response.status()).toBe(200);
    const redeemed = (await response.json()).item as {
      id: number;
      owner_user_id: number;
      origin_team_id: number;
      type: string;
    };
    expect(Number(redeemed.id)).toBe(resource.id);
    expect(Number(redeemed.owner_user_id)).toBe(resource.owner_user_id);
    expect(Number(redeemed.origin_team_id)).toBe(originTeam.id);
    expect(redeemed.type).toBe(resource.type);
  }

  const authorizedResponse = await collaboratorPage.request.get("/api/ai-store/items?authorized=me");
  expect(authorizedResponse.status()).toBe(200);
  const authorizedItems = (await authorizedResponse.json()).items as Array<{
    id: number;
    type: string;
    origin_team_id: number;
    origin_team_name: string;
  }>;
  for (const resource of resources) {
    const authorized = authorizedItems.find((item) => Number(item.id) === Number(resource.id));
    expect(authorized).toBeDefined();
    expect(authorized?.type).toBe(resource.type);
    expect(Number(authorized?.origin_team_id)).toBe(originTeam.id);
    expect(authorized?.origin_team_name).toBe(originTeam.name);
  }

  const unrelatedTeam = await createTeam(collaboratorPage.request, "Unrelated");
  const isolated = (await (await collaboratorPage.request.get(
    "/api/ai-store/items?authorized=me",
  )).json()).items as Array<{ id: number }>;
  expect(isolated.some((item) => resources.some((resource) => Number(resource.id) === Number(item.id))))
    .toBe(false);
  expect((await collaboratorPage.request.patch(`/api/ai-store/items/${resources[0]!.id}`, {
    data: {
      ...resources[0],
      expectedVersion: resources[0]!.version,
      action: "draft",
      description: "must not edit from unrelated Team",
      config: "blocked",
    },
  })).status()).toBe(403);

  expect((await collaboratorPage.request.post("/api/teams/current", {
    data: { teamId: receivingTeam.id },
  })).status()).toBe(200);
  await collaboratorPage.goto("/ai-store");
  await collaboratorPage.getByTestId("nav-authorized").click();
  const agent = resources[0]!;
  await expect(collaboratorPage.getByTestId(`authorized-item-${agent.id}`)).toBeVisible();
  await expect(collaboratorPage.getByTestId(`authorized-origin-team-${agent.id}`))
    .toHaveText(originTeam.name);
  await collaboratorPage.getByTestId(`authorized-edit-item-${agent.id}`).click();
  await expect(collaboratorPage.getByTestId("field-scope")).toBeDisabled();
  await expect(collaboratorPage.getByTestId("creator-type-template")).toBeDisabled();
  await expect(collaboratorPage.getByTestId("action-publish")).not.toBeVisible();
  await expect(collaboratorPage.getByTestId("action-submit-review")).not.toBeVisible();

  const maliciousEdit = await collaboratorPage.request.patch(`/api/ai-store/items/${agent.id}`, {
    data: {
      type: "template",
      scope: "platform",
      action: "submit_review",
      expectedVersion: agent.version,
      name: `${agent.name} edited`,
      description: "collaborator content update is live",
      config: "updated shared instructions",
    },
  });
  expect(maliciousEdit.status()).toBe(200);
  const editedRaw = (await maliciousEdit.json()).item as typeof agent & { description: string };
  const edited = {
    ...editedRaw,
    id: Number(editedRaw.id),
    version: Number(editedRaw.version),
    owner_user_id: Number(editedRaw.owner_user_id),
    origin_team_id: Number(editedRaw.origin_team_id),
  };
  expect(edited).toMatchObject({
    id: agent.id,
    type: "agent",
    scope: "personal",
    status: "published",
    owner_user_id: agent.owner_user_id,
    origin_team_id: originTeam.id,
    description: "collaborator content update is live",
  });
  expect((await collaboratorPage.request.post(`/api/ai-store/items/${agent.id}/share`)).status()).toBe(404);
  expect((await collaboratorPage.request.delete(`/api/ai-store/items/${agent.id}`)).status()).toBe(403);

  const ownerDetail = await ownerPage.request.get(`/api/ai-store/items/${agent.id}`);
  expect(ownerDetail.status()).toBe(200);
  const ownerItem = (await ownerDetail.json()).item as typeof edited;
  expect(ownerItem.description).toBe("collaborator content update is live");
  expect(Number(ownerItem.owner_user_id)).toBe(agent.owner_user_id);
  expect(Number(ownerItem.origin_team_id)).toBe(originTeam.id);

  const ownerWrongTeam = await createTeam(ownerPage.request, "Owner Other");
  expect(ownerWrongTeam.id).not.toBe(originTeam.id);
  expect((await ownerPage.request.get(`/api/ai-store/items/${agent.id}/share`)).status()).toBe(404);
  expect((await ownerPage.request.post("/api/teams/current", {
    data: { teamId: originTeam.id },
  })).status()).toBe(200);

  const shareInfo = await ownerPage.request.get(`/api/ai-store/items/${agent.id}/share`);
  expect(shareInfo.status()).toBe(200);
  const grantee = ((await shareInfo.json()).grantees as Array<{
    user_id: number;
    consumer_team_id: number;
    consumer_team_name: string;
  }>)[0]!;
  expect(Number(grantee.consumer_team_id)).toBe(receivingTeam.id);
  expect(grantee.consumer_team_name).toBe(receivingTeam.name);

  await ownerPage.goto("/ai-store");
  await ownerPage.getByTestId("nav-shared").click();
  await expect(ownerPage.getByTestId("shared-view")).toBeVisible();
  await expect(ownerPage.getByTestId(`shared-item-${agent.id}`)).toBeVisible();

  const revoke = await ownerPage.request.delete(
    `/api/ai-store/items/${agent.id}/share/grantees/${grantee.user_id}?consumerTeamId=${receivingTeam.id}`,
  );
  expect(revoke.status()).toBe(200);
  expect((await collaboratorPage.request.patch(`/api/ai-store/items/${agent.id}`, {
    data: {
      type: "agent",
      scope: "personal",
      action: "draft",
      expectedVersion: edited.version,
      name: edited.name,
      description: "revoked edit",
      config: "revoked",
    },
  })).status()).toBe(403);
  const afterRevoke = (await (await collaboratorPage.request.get(
    "/api/ai-store/items?authorized=me",
  )).json()).items as Array<{ id: number }>;
  expect(afterRevoke.some((item) => Number(item.id) === Number(agent.id))).toBe(false);

  await ownerContext.close();
  await collaboratorContext.close();
});
