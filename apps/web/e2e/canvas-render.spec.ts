import { test, expect } from "@playwright/test";

const uniq = () => `cr_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("打开房间的板，渲染已有 item", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Board Room" } })).json()).room;
  const item = (await (await page.request.post(`/api/rooms/${room.id}/items`, {
    data: { type: "note", x: 30, y: 40, text: "已有便签" },
  })).json()).item;

  await page.goto(`/rooms/${room.id}/board`);
  await expect(page.getByTestId(`item-${item.id}`)).toBeVisible();
  await expect(page.getByTestId(`text-${item.id}`)).toHaveValue("已有便签");
});
