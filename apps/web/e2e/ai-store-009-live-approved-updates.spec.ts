import { expect, test, type APIRequestContext } from "@playwright/test";

test.setTimeout(180_000);

const uniq = (tag: string) =>
  `p27_f06_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;

async function registerWithTeam(request: APIRequestContext, tag: string) {
  const email = uniq(tag);
  expect((await request.post("/api/auth/register", {
    data: { firstName: tag, lastName: "User", email, password: "secret123", agreeTerms: true },
  })).ok()).toBeTruthy();
  expect((await request.post("/api/teams", { data: { name: `${tag} Team ${Date.now()}` } })).status()).toBe(201);
  return email;
}

test("approved updates stay approved and sync to subscribers; revoke blocks new use", async ({
  page,
  playwright,
  baseURL,
}) => {
  const creator = await playwright.request.newContext({ baseURL });
  await registerWithTeam(creator, "Creator");
  const create = await creator.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "platform",
      action: "submit_review",
      name: `Approved Live Agent ${Date.now()}`,
      description: "Version one",
      config: "Initial instructions",
    },
  });
  expect(create.status()).toBe(201);
  const pending = (await create.json()).item as { id: number; version: number; name: string };

  const adminEmail = await registerWithTeam(page.request, "Admin");
  expect((await page.request.post("/api/dev/grant-sysadmin", { data: { email: adminEmail } })).ok()).toBeTruthy();
  const approve = await page.request.post(`/api/admin/ai-store/${pending.id}/review`, {
    data: { action: "approve" },
  });
  expect(approve.ok()).toBeTruthy();
  const approved = (await approve.json()).item as { version: number; status: string };
  expect(approved.status).toBe("approved");

  const consumer = await playwright.request.newContext({ baseURL });
  await registerWithTeam(consumer, "Consumer");
  expect((await consumer.post(`/api/ai-store/items/${pending.id}/subscribe`, {
    data: { scope: "personal" },
  })).status()).toBe(201);

  const edit = await creator.patch(`/api/ai-store/items/${pending.id}`, {
    data: {
      type: "agent",
      scope: "platform",
      action: "draft",
      expectedVersion: approved.version,
      name: pending.name,
      description: "Version two is live immediately",
      config: "Updated instructions",
    },
  });
  expect(edit.ok()).toBeTruthy();
  expect((await edit.json()).item.status).toBe("approved");

  const subscribed = await consumer.get("/api/ai-store/items?subscribed=me");
  const subscribedItem = (await subscribed.json()).items.find(
    (item: { id: number | string }) => String(item.id) === String(pending.id),
  );
  expect(subscribedItem.description).toBe("Version two is live immediately");
  expect(subscribedItem.unavailable).toBe(false);

  expect((await page.request.post(`/api/admin/ai-store/${pending.id}/review`, {
    data: { action: "revoke" },
  })).ok()).toBeTruthy();

  const afterRevoke = await consumer.get("/api/ai-store/items?subscribed=me");
  const unavailable = (await afterRevoke.json()).items.find(
    (item: { id: number | string }) => String(item.id) === String(pending.id),
  );
  expect(unavailable.unavailable).toBe(true);
  expect((await consumer.get(`/api/ai-store/items/${pending.id}`)).status()).toBe(404);

  const newcomer = await playwright.request.newContext({ baseURL });
  await registerWithTeam(newcomer, "Newcomer");
  expect((await newcomer.post(`/api/ai-store/items/${pending.id}/subscribe`, {
    data: { scope: "personal" },
  })).status()).toBe(404);

  await creator.dispose();
  await consumer.dispose();
  await newcomer.dispose();
});
