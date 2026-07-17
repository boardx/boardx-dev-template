import { expect, test } from "@playwright/test";

test.setTimeout(180_000);

test("legacy tool inputs keep their item relationships while public APIs expose Skills", async ({ page }) => {
  const email = `p27_f12_${Date.now()}_${Math.random()}@example.com`;
  expect((await page.request.post("/api/auth/register", { data: {
    firstName: "Legacy", lastName: "User", email, password: "secret123", agreeTerms: true,
  } })).status()).toBe(201);
  expect((await page.request.post("/api/teams", { data: { name: `Legacy Team ${Date.now()}` } })).status()).toBe(201);

  for (const legacyType of ["ai-tool", "image-tool"] as const) {
    const created = await page.request.post("/api/ai-store/items", { data: {
      type: legacyType,
      scope: "personal",
      action: "publish",
      name: `${legacyType} compatibility`,
      description: "Legacy relationship compatibility",
      config: "legacy instructions",
    } });
    expect(created.status()).toBe(201);
    const item = (await created.json()).item;
    expect(item.type).toBe("skill");
    expect(item.config.skillKind).toBe(legacyType === "image-tool" ? "image" : "text");
    const itemId = Number(item.id);

    expect((await page.request.post(`/api/ai-store/items/${itemId}/subscribe`, {
      data: { scope: "personal" },
    })).status()).toBe(201);
    expect((await page.request.post(`/api/ai-store/items/${itemId}/favorite`)).status()).toBe(200);
    const share = await page.request.post(`/api/ai-store/items/${itemId}/share`);
    expect(share.status()).toBe(201);

    const updated = await page.request.patch(`/api/ai-store/items/${itemId}`, { data: {
      type: legacyType,
      scope: "personal",
      action: "draft",
      expectedVersion: Number(item.version),
      name: item.name,
      description: "Updated without replacing the legacy item",
      config: "updated legacy instructions",
    } });
    expect(updated.status()).toBe(200);
    expect(Number((await updated.json()).item.id)).toBe(itemId);

    const subscribed = await (await page.request.get("/api/ai-store/items?subscribed=me")).json();
    expect(subscribed.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: String(itemId), type: "skill" }),
    ]));
    const shareInfo = await page.request.get(`/api/ai-store/items/${itemId}/share`);
    expect(shareInfo.status()).toBe(200);
    expect((await shareInfo.json()).share.share_enabled).toBe(true);
    const use = await page.request.post(`/api/ai-store/items/${itemId}/use`);
    expect(use.status()).toBe(200);
    expect((await use.json()).item.type).toBe("skill");
  }

  const publicList = await (await page.request.get("/api/ai-store/items?owner=me")).json();
  expect(publicList.items.every((item: { type: string }) => ["agent", "skill", "template"].includes(item.type))).toBe(true);
});
