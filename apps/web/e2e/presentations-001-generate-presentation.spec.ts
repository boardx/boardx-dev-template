import { test, expect } from "@playwright/test";

const uniq = () => `pg_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "P", lastName: "G", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("已登录：配置表单 → 生成 → 显示生成的幻灯片大纲", async ({ page }) => {
  await register(page);
  await page.goto("/presentations");

  // 初始空态可见
  await expect(page.getByTestId("empty")).toBeVisible();

  // 填配置并生成
  await page.getByTestId("deck-title").fill("Q3 产品发布计划");
  await page.getByTestId("deck-pages").selectOption("5");
  await page.getByTestId("deck-style").selectOption("vibrant");
  await page.getByTestId("generate").click();

  // 结果 deck 可见，含标题与幻灯片大纲
  const list = page.getByTestId("deck-list");
  await expect(list).toBeVisible();
  await expect(list).toContainText("Q3 产品发布计划");
  await expect(list).toContainText("5 页");
  await expect(list).toContainText("Vibrant");
});

test("标题为空被拒（保留错误提示）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/presentations", { data: { title: "   " } });
  expect(res.status()).toBe(400);
});

test("空大纲提示使用默认提示生成", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/presentations", {
    data: { title: "默认提示测试", pages: 10 },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.deck.prompt).toContain("根据当前对话和文件内容");
  expect(body.deck.slides).toHaveLength(10);
});

test("未登录访问 /presentations → 跳转登录", async ({ page }) => {
  await page.goto("/presentations");
  await expect(page).toHaveURL(/\/login/);
});

test("未登录调用生成接口 → 401", async ({ page }) => {
  const res = await page.request.post("/api/presentations", {
    data: { title: "x" },
  });
  expect(res.status()).toBe(401);
});
