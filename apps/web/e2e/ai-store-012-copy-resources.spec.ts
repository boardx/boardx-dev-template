import { expect, test, type APIRequestContext } from "@playwright/test";

test.setTimeout(180_000);

const uniq = (tag: string) =>
  `p27_f10_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function register(request: APIRequestContext, tag: string) {
  const response = await request.post("/api/auth/register", {
    data: {
      firstName: tag,
      lastName: "User",
      email: uniq(tag),
      password: "secret123",
      agreeTerms: true,
    },
  });
  expect(response.status()).toBe(201);
}

async function createTeam(request: APIRequestContext, tag: string) {
  const response = await request.post("/api/teams", {
    data: { name: `${tag} Team ${Date.now()}` },
  });
  expect(response.status()).toBe(201);
  return Number((await response.json()).team.id);
}

async function createResource(
  request: APIRequestContext,
  type: "agent" | "skill" | "template",
  allowCopy: boolean,
  templateBoardId?: number,
) {
  const response = await request.post("/api/ai-store/items", {
    data: {
      type,
      skillKind: type === "skill" ? "text" : undefined,
      scope: "personal",
      action: "publish",
      name: `Copy ${type} ${Date.now()} ${Math.random()}`,
      description: `${type} source version one`,
      config: `${type} source instructions`,
      allowCopy,
      templateBoardId,
    },
  });
  expect(response.status()).toBe(201);
  const item = (await response.json()).item as {
    id: number;
    name: string;
    version: number;
    allow_copy: boolean;
  };
  return { ...item, id: Number(item.id), version: Number(item.version) };
}

async function authorize(
  owner: APIRequestContext,
  consumer: APIRequestContext,
  itemId: number,
) {
  const share = await owner.post(`/api/ai-store/items/${itemId}/share`);
  expect(share.status()).toBe(201);
  const token = (await share.json()).share.share_token as string;
  const redeem = await consumer.post(
    `/api/ai-store/items/${itemId}/share/redeem?shareToken=${encodeURIComponent(token)}`,
  );
  expect(redeem.status()).toBe(200);
}

test("allowCopy creates independent Team-owned drafts and deep-copies Template boards", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await register(ownerPage.request, "CopyOwner");
  const originTeamId = await createTeam(ownerPage.request, "CopyOrigin");

  const roomResponse = await ownerPage.request.post("/api/rooms", {
    data: { name: "Template Source Room", visibility: "team", teamId: originTeamId },
  });
  expect(roomResponse.status()).toBe(201);
  const sourceRoomId = Number((await roomResponse.json()).room.id);
  const boardResponse = await ownerPage.request.post(`/api/rooms/${sourceRoomId}/boards`, {
    data: { name: "Template Source Board" },
  });
  expect(boardResponse.status()).toBe(201);
  const sourceBoardId = Number((await boardResponse.json()).board.id);
  const boardItemResponse = await ownerPage.request.post(`/api/boards/${sourceBoardId}/items`, {
    data: { type: "note", x: 24, y: 36, text: "Deep copied template content" },
  });
  expect(boardItemResponse.status()).toBe(201);
  const sourceBoardItemId = String((await boardItemResponse.json()).item.id);

  const agent = await createResource(ownerPage.request, "agent", true);
  const skill = await createResource(ownerPage.request, "skill", true);
  const template = await createResource(ownerPage.request, "template", true, sourceBoardId);
  const blocked = await createResource(ownerPage.request, "agent", false);

  const consumerContext = await browser.newContext();
  const consumerPage = await consumerContext.newPage();
  await register(consumerPage.request, "CopyConsumer");
  const consumerTeamId = await createTeam(consumerPage.request, "CopyConsumer");

  for (const resource of [agent, skill, template, blocked]) {
    await authorize(ownerPage.request, consumerPage.request, resource.id);
  }

  expect((await consumerPage.request.post(`/api/ai-store/items/${blocked.id}/copy`, {
    headers: { "Idempotency-Key": "blocked-copy" },
  })).status()).toBe(403);

  const copies = [] as Array<{
    source: typeof agent;
    item: {
      id: number;
      type: string;
      scope: string;
      status: string;
      owner_user_id: number;
      origin_team_id: number;
      copied_from_item_id: number;
      copied_from_version: number;
      allow_copy: boolean;
      likes: number;
      views: number;
      featured: boolean;
      config: { templateBoardId?: number };
    };
    board?: { id: number; room_id: number; team_id: number; owner_user_id: number };
  }>;

  for (const source of [agent, skill, template]) {
    const response = await consumerPage.request.post(`/api/ai-store/items/${source.id}/copy`, {
      headers: { "Idempotency-Key": `copy-${source.id}` },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    const copiedItem = data.item;
    expect(Number(copiedItem.id)).not.toBe(source.id);
    expect(copiedItem).toMatchObject({
      scope: "personal",
      status: "draft",
      allow_copy: false,
      likes: 0,
      views: 0,
      featured: false,
    });
    expect(Number(copiedItem.origin_team_id)).toBe(consumerTeamId);
    expect(Number(copiedItem.copied_from_item_id)).toBe(source.id);
    expect(Number(copiedItem.copied_from_version)).toBe(source.version);
    copies.push({ source, item: copiedItem, board: data.board });
  }

  const repeated = await consumerPage.request.post(`/api/ai-store/items/${agent.id}/copy`, {
    headers: { "Idempotency-Key": `copy-${agent.id}` },
  });
  expect(repeated.status()).toBe(200);
  expect(Number((await repeated.json()).item.id)).toBe(Number(copies[0]!.item.id));

  const subscribed = (await (await consumerPage.request.get(
    "/api/ai-store/items?subscribed=me",
  )).json()).items as Array<{ id: number }>;
  expect(subscribed.some((item) => copies.some((copy) => Number(copy.item.id) === Number(item.id))))
    .toBe(false);

  const templateCopy = copies.find((copy) => copy.source.id === template.id)!;
  expect(templateCopy.board).toBeDefined();
  expect(Number(templateCopy.board!.team_id)).toBe(consumerTeamId);
  expect(Number(templateCopy.item.config.templateBoardId)).toBe(Number(templateCopy.board!.id));
  const copiedBoardItems = (await (await consumerPage.request.get(
    `/api/boards/${templateCopy.board!.id}/items`,
  )).json()).items as Array<{ id: string; text: string; board_id: number }>;
  expect(copiedBoardItems).toHaveLength(1);
  expect(copiedBoardItems[0]?.text).toBe("Deep copied template content");
  expect(copiedBoardItems[0]?.id).not.toBe(sourceBoardItemId);
  expect(Number(copiedBoardItems[0]?.board_id)).toBe(Number(templateCopy.board!.id));

  const sourceEdit = await ownerPage.request.patch(`/api/ai-store/items/${agent.id}`, {
    data: {
      type: "agent",
      scope: "personal",
      action: "draft",
      expectedVersion: agent.version,
      name: agent.name,
      description: "source changed after copy",
      config: "new source instructions",
      allowCopy: true,
    },
  });
  expect(sourceEdit.status()).toBe(200);
  const independentCopy = await consumerPage.request.get(`/api/ai-store/items/${copies[0]!.item.id}`);
  expect(independentCopy.status()).toBe(200);
  expect((await independentCopy.json()).item.description).toBe("agent source version one");

  await ownerContext.close();
  await consumerContext.close();
});
