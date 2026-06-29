import { test, expect } from "@playwright/test";

const uniq = () => `rc_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("创建房间后出现在列表", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/rooms");
  await page.getByTestId("show-create").click();
  await page.getByTestId("room-name").fill("My First Room");
  await page.getByTestId("create").click();
  await expect(page.getByTestId("room-list")).toContainText("My First Room");
});

test("空房间名被拒", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const res = await page.request.post("/api/rooms", { data: { name: "   " } });
  expect(res.status()).toBe(400);
});
