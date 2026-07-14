import { test, expect, type Page } from "@playwright/test";

const uniq = () => `tm_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// 04-F13（uc-team-009）：团队 Memory——搜索/新增/删除团队可复用 AI 上下文。
async function ownerWithTeam(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Mem", lastName: "Owner", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const team = (await (await page.request.post("/api/teams", { data: { name: `Mem Team ${Date.now()}` } })).json()).team;
  return team as { id: number };
}

test("新增（Enter/按钮）、去重提示、搜索过滤计数、确认删除", async ({ page }) => {
  const team = await ownerWithTeam(page);
  await page.goto(`/teams/${team.id}/memory`);
  await expect(page.getByTestId("team-memory")).toBeVisible();
  await expect(page.getByTestId("memory-empty")).toBeVisible();

  // 按钮新增。
  await page.getByTestId("memory-input").fill("Prefer concise answers");
  await page.getByTestId("memory-add").click();
  await expect(page.getByTestId("memory-notice")).toContainText("已新增");
  await expect(page.getByTestId("memory-list")).toContainText("Prefer concise answers");

  // Enter 新增第二条。
  await page.getByTestId("memory-input").fill("Team ships weekly");
  await page.getByTestId("memory-input").press("Enter");
  await expect(page.getByTestId("memory-count")).toContainText("2");

  // 重复内容 → 已存在提示，列表不变。
  await page.getByTestId("memory-input").fill("Team ships weekly");
  await page.getByTestId("memory-add").click();
  await expect(page.getByTestId("memory-error")).toContainText("已存在");
  await expect(page.getByTestId("memory-count")).toContainText("2");

  // 搜索过滤：保留 总数/过滤数。
  await page.getByTestId("memory-search").fill("concise");
  await expect(page.getByTestId("memory-count")).toContainText("1 / 2");
  await expect(page.getByTestId("memory-list")).not.toContainText("Team ships weekly");
  await page.getByTestId("memory-search").fill("zzz");
  await expect(page.getByTestId("memory-empty")).toBeVisible();
  await page.getByTestId("memory-search").fill("");

  // 删除走确认弹窗。
  const item = page.locator('[data-testid^="memory-delete-"]').first();
  await item.click();
  await expect(page.getByTestId("memory-confirm")).toBeVisible();
  await page.getByTestId("memory-confirm-delete").click();
  await expect(page.getByTestId("memory-notice")).toContainText("已删除");
  await expect(page.getByTestId("memory-count")).toContainText("1");
});

test("空内容不新增；member 无权限进入", async ({ page }) => {
  const team = await ownerWithTeam(page);
  await page.goto(`/teams/${team.id}/memory`);
  await page.getByTestId("memory-input").fill("   ");
  await expect(page.getByTestId("memory-add")).toBeDisabled();

  // 团队 Home 有 Memory 入口卡片。
  await page.goto(`/teams/${team.id}`);
  await page.getByTestId("entry-memory").click();
  await expect(page.getByTestId("team-memory")).toBeVisible();

  // 非成员（新用户）访问 → 无权限态。
  await page.request.post("/api/auth/register", {
    data: { firstName: "Out", lastName: "Sider", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/teams/${team.id}/memory`);
  await expect(page.getByTestId("team-memory-forbidden")).toBeVisible();
});

test("保存失败回退并提示", async ({ page }) => {
  const team = await ownerWithTeam(page);
  await page.goto(`/teams/${team.id}/memory`);
  await page.getByTestId("memory-input").fill("Will fail");
  await page.route(`**/api/teams/${team.id}/memories`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' });
      return;
    }
    await route.continue();
  });
  await page.getByTestId("memory-add").click();
  await expect(page.getByTestId("memory-error")).toContainText("保存失败");
  await expect(page.getByTestId("memory-empty")).toBeVisible();
});
