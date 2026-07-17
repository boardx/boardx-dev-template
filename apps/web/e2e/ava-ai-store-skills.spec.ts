import { expect, test, type APIRequestContext } from "@playwright/test";

test.setTimeout(180_000);
const email = (tag: string) => `p27_f11_${tag}_${Date.now()}_${Math.random()}@example.com`;

async function register(request: APIRequestContext) {
  expect((await request.post("/api/auth/register", { data: {
    firstName: "Runtime", lastName: "User", email: email("runtime"), password: "secret123", agreeTerms: true,
  } })).status()).toBe(201);
}

async function team(request: APIRequestContext, name: string) {
  const response = await request.post("/api/teams", { data: { name: `${name} ${Date.now()}` } });
  expect(response.status()).toBe(201);
  return Number((await response.json()).team.id);
}

async function resource(request: APIRequestContext, type: "agent" | "skill", skillKind?: "text" | "image") {
  const response = await request.post("/api/ai-store/items", { data: {
    type, skillKind, scope: "personal", action: "publish", name: `${skillKind ?? type} runtime`,
    description: `latest ${type}`, config: `${type} runtime instructions`,
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: number };
}

test("AVA exposes and executes only current-Team subscribed Agents and text/image Skills", async ({ page }) => {
  await register(page.request);
  const teamA = await team(page.request, "Runtime A");
  const agent = await resource(page.request, "agent");
  const textSkill = await resource(page.request, "skill", "text");
  const imageSkill = await resource(page.request, "skill", "image");
  for (const item of [agent, textSkill, imageSkill]) {
    expect((await page.request.post(`/api/ai-store/items/${item.id}/subscribe`, { data: { scope: "personal" } })).status()).toBe(201);
  }

  const capabilities = await page.request.get("/api/ava/capabilities");
  expect(capabilities.status()).toBe(200);
  const data = await capabilities.json();
  expect(data.teamId).toBe(teamA);
  expect(data.agents).toEqual(expect.arrayContaining([expect.objectContaining({ id: `store-${agent.id}`, version: 1 })]));
  expect(data.tools).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: `store-skill-${textSkill.id}`, skillKind: "text" }),
    expect.objectContaining({ id: `store-skill-${imageSkill.id}`, skillKind: "image" }),
  ]));

  const threadResponse = await page.request.post("/api/ava/threads");
  expect(threadResponse.status()).toBe(201);
  const threadId = Number((await threadResponse.json()).thread.id);
  const message = await page.request.post(`/api/ava/threads/${threadId}/messages`, { data: {
    text: "Run the subscribed runtime resources",
    agentId: `store-${agent.id}`,
    toolIds: [`store-skill-${textSkill.id}`, `store-skill-${imageSkill.id}`],
  } });
  expect(message.status()).toBe(201);
  const stream = await message.text();
  expect(stream).toContain(`store-${agent.id}`);
  expect(stream).toContain(`store-skill-${textSkill.id}`);
  expect(stream).toContain(`store-skill-${imageSkill.id}`);

  await team(page.request, "Runtime B");
  const otherTeam = await (await page.request.get("/api/ava/capabilities")).json();
  expect(otherTeam.agents.some((option: { id: string }) => option.id === `store-${agent.id}`)).toBe(false);
  expect(otherTeam.tools.some((option: { id: string }) => option.id === `store-skill-${textSkill.id}`)).toBe(false);
  expect((await page.request.post(`/api/ai-store/items/${agent.id}/use`)).status()).toBe(403);
});
