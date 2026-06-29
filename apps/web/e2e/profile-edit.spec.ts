import { test, expect } from "@playwright/test";

const uniq = () => `ped_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("改显示名 + 选头像，保存后菜单刷新", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/account");
  await expect(page.getByTestId("display-name")).toHaveValue("A B"); // 等加载完成，避免覆盖输入
  await page.getByTestId("display-name").fill("Super Ada");
  await page.getByTestId("avatar-opt-1").click();
  await page.getByTestId("save-personal").click();
  await expect(page.getByTestId("saved")).toBeVisible();

  // GET /api/profile 返回新值
  const p = (await (await page.request.get("/api/profile")).json()).profile;
  expect(p.displayName).toBe("Super Ada");
  expect(p.avatar).toBe("seed:b2");

  // 首页菜单刷新
  await page.goto("/");
  await expect(page.getByTestId("menu-displayname")).toContainText("Super Ada");
  await expect(page.getByTestId("menu-avatar")).toContainText("seed:b2");
});

test("空显示名被拒", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/account");
  await expect(page.getByTestId("display-name")).toHaveValue("A B");
  await page.getByTestId("display-name").fill("   ");
  await page.getByTestId("save-personal").click();
  await expect(page.getByTestId("err")).toBeVisible();
});

test("AI generate 更新头像预览", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/account");
  await page.getByTestId("avatar-generate").click();
  await expect(page.getByTestId("avatar-preview")).toContainText("seed:gen");
});
