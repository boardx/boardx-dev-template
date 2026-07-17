import { expect, test, type APIRequestContext } from "@playwright/test";

test.setTimeout(180_000);
const uniq = () => `p27_f11_builder_${Date.now()}_${Math.random()}@example.com`;

async function setup(request: APIRequestContext) {
  expect((await request.post("/api/auth/register", { data: {
    firstName: "Builder", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true,
  } })).status()).toBe(201);
  const teamResponse = await request.post("/api/teams", { data: { name: `Builder Team ${Date.now()}` } });
  expect(teamResponse.status()).toBe(201);
  return Number((await teamResponse.json()).team.id);
}

async function item(request: APIRequestContext, body: Record<string, unknown>) {
  const response = await request.post("/api/ai-store/items", { data: {
    scope: "personal", action: "publish", description: "runtime resource", config: "runtime instructions", ...body,
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: number };
}

test("Builder drafts, Team-filtered recommendations, and Template instantiation are integrated", async ({ page }) => {
  const teamId = await setup(page.request);
  const builder = await page.request.post("/api/ai-store/agent-builder/turn", { data: {
    latestUserInput: "Create a customer interview synthesis agent for product teams",
    answers: {}, currentQuestionKey: null, availableModels: ["stub:default"],
  } });
  expect(builder.status()).toBe(200);
  const draft = (await builder.json()).draft;
  expect(draft).toMatchObject({ type: "agent", scope: "personal", teamId });
  expect(draft.name).toContain("Customer Interview");
  expect(draft.config.instructions.length).toBeGreaterThan(20);
  expect(Array.isArray(draft.suggestedQuestions)).toBe(true);

  const skill = await item(page.request, { type: "skill", skillKind: "text", name: "Interview Skill" });
  const agent = await item(page.request, {
    type: "agent", name: "Interview Follow-up Agent", relatedSkillIds: [skill.id],
  });
  for (const resource of [skill, agent]) {
    expect((await page.request.post(`/api/ai-store/items/${resource.id}/subscribe`, { data: { scope: "personal" } })).status()).toBe(201);
  }
  const recommendations = await page.request.get(`/api/ai-store/items/${skill.id}/recommendations`);
  expect(recommendations.status()).toBe(200);
  expect((await recommendations.json()).items).toEqual([
    expect.objectContaining({ id: agent.id, type: "agent" }),
  ]);

  const room = await page.request.post("/api/rooms", { data: { name: "Template Source", visibility: "team", teamId } });
  const roomId = Number((await room.json()).room.id);
  const board = await page.request.post(`/api/rooms/${roomId}/boards`, { data: { name: "Interview Board" } });
  const boardId = Number((await board.json()).board.id);
  const sourceItem = await page.request.post(`/api/boards/${boardId}/items`, {
    data: { type: "note", x: 24, y: 36, text: "Interview evidence" },
  });
  expect(sourceItem.status()).toBe(201);
  const template = await item(page.request, { type: "template", name: "Interview Template", templateBoardId: boardId });
  await page.request.post(`/api/ai-store/items/${template.id}/subscribe`, { data: { scope: "personal" } });
  const useTemplate = await page.request.post(`/api/ai-store/items/${template.id}/use`, {
    headers: { "Idempotency-Key": `use-template-${template.id}` },
  });
  expect(useTemplate.status()).toBe(201);
  const instantiated = await useTemplate.json();
  expect(Number(instantiated.board.team_id)).toBe(teamId);
  const contents = await (await page.request.get(`/api/boards/${instantiated.board.id}/items`)).json();
  expect(contents.items).toEqual([expect.objectContaining({ text: "Interview evidence" })]);
});
