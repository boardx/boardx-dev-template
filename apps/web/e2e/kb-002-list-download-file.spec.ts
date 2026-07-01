import { test, expect } from "@playwright/test";

// uc-kb-002 验收契约：文件列表查看/搜索/刷新/分页/下载（p10-F02）。
// 覆盖：列表按 scope+权限过滤展示；搜索按名称过滤；刷新按钮重新拉取；
// 分页在超过一页时可翻页；下载走鉴权 URL（不是对象存储直链）；
// 未 ready 文件不可下载；跨用户不可见彼此文件；加载失败可重试。
// 真实链路：GET /api/kb/files?scope=&q=&page=&pageSize= → kb_files 表；
// 下载 GET /api/kb/files/:id/download → 鉴权检查 → 302 到短期预签名 URL。

const uniq = () => `kb2_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  return email;
}

async function uploadAndWaitReady(page: import("@playwright/test").Page, name: string) {
  await page.getByTestId("file-input").setInputFiles({
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(`content of ${name}`),
  });
  await expect(page.getByTestId("file-list")).toContainText(name, { timeout: 15_000 });
  const row = page.getByTestId(new RegExp(`^file-status-`)).first();
  await expect(row).toHaveText("ready", { timeout: 30_000 });
}

test("文件列表：展示已上传文件，含名称/类型/大小/状态", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  await uploadAndWaitReady(page, "list-check.pdf");

  await expect(page.getByTestId("file-list")).toContainText("list-check.pdf");
  await expect(page.getByTestId("file-list")).toContainText("PDF");
});

test("搜索：按名称过滤，仅展示匹配文件", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  await uploadAndWaitReady(page, "alpha-report.pdf");
  await page.getByTestId("file-input").setInputFiles({
    name: "beta-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("beta content"),
  });
  await expect(page.getByTestId("file-list")).toContainText("beta-notes.txt", { timeout: 15_000 });

  await page.getByTestId("search").fill("alpha");
  await page.getByTestId("search-btn").click();

  await expect(page.getByTestId("file-list")).toContainText("alpha-report.pdf");
  await expect(page.getByTestId("file-list")).not.toContainText("beta-notes.txt");
});

test("刷新：点击刷新按钮重新拉取列表", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  await uploadAndWaitReady(page, "refresh-check.pdf");

  await page.getByTestId("refresh-btn").click();
  await expect(page.getByTestId("file-list")).toContainText("refresh-check.pdf");
});

test("分页：文件数超过一页时可翻页，页码指示正确", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  // 页大小为 10，上传 11 个文件触发第二页。
  for (let i = 0; i < 11; i++) {
    await page.getByTestId("file-input").setInputFiles({
      name: `page-file-${String(i).padStart(2, "0")}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(`file ${i}`),
    });
    await expect(page.getByTestId("file-list")).toContainText(`page-file-${String(i).padStart(2, "0")}.txt`, {
      timeout: 15_000,
    });
  }

  await expect(page.getByTestId("page-indicator")).toHaveText("Page 1 / 2");
  await expect(page.getByTestId("page-prev")).toBeDisabled();

  await page.getByTestId("page-next").click();
  await expect(page.getByTestId("page-indicator")).toHaveText("Page 2 / 2");
  await expect(page.getByTestId("page-next")).toBeDisabled();

  await page.getByTestId("page-prev").click();
  await expect(page.getByTestId("page-indicator")).toHaveText("Page 1 / 2");
});

test("下载：ready 文件点下载走鉴权 URL 而非对象存储直链", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  await uploadAndWaitReady(page, "download-check.pdf");

  const downloadTestId = await page.locator('[data-testid^="download-"]').first().getAttribute("data-testid");
  const fileId = downloadTestId?.replace(/^download-/, "");
  expect(fileId).toBeTruthy();

  // 鉴权后的下载接口应 302 重定向到预签名对象存储 URL（不是直接把对象存储凭据/直链交给未鉴权请求）。
  const res = await page.request.get(`/api/kb/files/${fileId}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const location = res.headers()["location"] ?? "";
  expect(location).toBeTruthy();
  expect(location).not.toBe(`/api/kb/files/${fileId}/download`);

  // 下载按钮在 ready 状态下可点击（不 disabled）。
  await expect(page.getByTestId(`download-${fileId}`)).toBeEnabled();
});

test("下载鉴权：未登录直接请求下载接口 → 401", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const res = await page.request.get("/api/kb/files/kbf_nonexistent/download", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  await context.close();
});

test("下载鉴权：跨用户不可下载他人文件 → 403 且列表不可见", async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await register(pageA);
  await pageA.goto("/knowledge-base");
  await uploadAndWaitReady(pageA, "owner-only.pdf");

  const downloadTestId = await pageA.locator('[data-testid^="download-"]').first().getAttribute("data-testid");
  const fileId = downloadTestId?.replace(/^download-/, "");
  expect(fileId).toBeTruthy();

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await register(pageB);
  await pageB.goto("/knowledge-base");

  // 另一用户的知识库列表里看不到别人的文件（scope=personal 天然隔离）。
  await expect(pageB.getByTestId("empty")).toBeVisible();
  await expect(pageB.getByTestId("file-list")).toHaveCount(0);

  const res = await pageB.request.get(`/api/kb/files/${fileId}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(403);

  await ctxA.close();
  await ctxB.close();
});

test("加载失败可重试：网络异常时展示错误与重试按钮", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  // 让下一次列表请求失败，验证错误提示 + 重试按钮出现，点击后恢复正常。
  let failedOnce = false;
  await page.route("**/api/kb/files?**", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 500, body: JSON.stringify({ error: "boom" }) });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("refresh-btn").click();
  await expect(page.getByTestId("err")).toBeVisible();
  await expect(page.getByTestId("retry-btn")).toBeVisible();

  await page.getByTestId("retry-btn").click();
  await expect(page.getByTestId("err")).toHaveCount(0);
});

test("未登录访问 /knowledge-base → 跳登录", async ({ page }) => {
  await page.goto("/knowledge-base");
  await expect(page).toHaveURL(/\/login/);
});
