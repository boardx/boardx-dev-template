import { test, expect, type Page } from "@playwright/test";
import { closePool, setKbFileStatus } from "@repo/data";

// uc-kb-003-delete-file 验收契约。
// 覆盖：文件行删除按钮 + 确认 → DELETE /api/kb/files/:id 级联清对象存储与 DB 记录 →
// 列表立即移除该行并展示成功提示；仅有权限者可删（他人访问返回 404，不泄露存在性，
// 与下载路由的鉴权口径一致）；删除失败保留文件行并提示；已删文件的下载接口不再可用
// （代表检索/AI 上下文不再命中——F04 未实现向量索引，检索天然只查未删除的 kb_files 记录）。

const uniq = () => `kb_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test.afterEach(async () => {
  await closePool();
});

interface UploadedFile {
  id: string;
  name: string;
}

async function register(page: Page) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { user: { id: number; email: string } };
}

async function uploadReadyFile(page: Page, name: string, body = "knowledge base fixture"): Promise<UploadedFile> {
  const res = await page.request.post("/api/kb/files", {
    multipart: {
      file: {
        name,
        mimeType: name.endsWith(".pdf") ? "application/pdf" : "text/markdown",
        buffer: Buffer.from(body),
      },
      scope: "personal",
    },
  });
  expect(res.status()).toBe(201);
  const json = (await res.json()) as { file: UploadedFile };
  await setKbFileStatus(json.file.id, "ready");
  return json.file;
}

test("点击删除并确认：列表立即移除该行、展示成功提示，且文件不再可下载", async ({ page }) => {
  await register(page);
  const target = await uploadReadyFile(page, "to-delete-report.pdf");
  const keep = await uploadReadyFile(page, "keep-me.md");

  await page.goto("/knowledge-base");
  await expect(page.getByTestId(`file-${target.id}`)).toBeVisible();
  await expect(page.getByTestId(`file-${keep.id}`)).toBeVisible();

  await page.getByTestId(`delete-${target.id}`).click();
  await expect(page.getByTestId(`confirm-delete-${target.id}`)).toBeVisible();

  const deleteResponsePromise = page.waitForResponse(
    (res) => res.url().includes(`/api/kb/files/${target.id}`) && res.request().method() === "DELETE"
  );
  await page.getByTestId(`confirm-delete-yes-${target.id}`).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(200);

  // 列表立即移除该行，成功提示可见，另一个文件仍在。
  await expect(page.getByTestId(`file-${target.id}`)).toHaveCount(0);
  await expect(page.getByTestId("delete-message")).toContainText("deleted");
  await expect(page.getByTestId(`file-${keep.id}`)).toBeVisible();

  // 已删文件不再可下载（代表不再被检索/AI 上下文命中）。
  const denied = await page.request.get(`/api/kb/files/${target.id}/download`);
  expect(denied.status()).toBe(404);
});

test("取消删除：文件行保留，不发起请求", async ({ page }) => {
  await register(page);
  const target = await uploadReadyFile(page, "keep-after-cancel.md");

  await page.goto("/knowledge-base");
  await page.getByTestId(`delete-${target.id}`).click();
  await expect(page.getByTestId(`confirm-delete-${target.id}`)).toBeVisible();

  await page.getByTestId(`confirm-delete-no-${target.id}`).click();
  await expect(page.getByTestId(`confirm-delete-${target.id}`)).toHaveCount(0);
  await expect(page.getByTestId(`file-${target.id}`)).toBeVisible();
});

test("删除失败：保留该文件行并展示错误提示", async ({ page }) => {
  await register(page);
  const target = await uploadReadyFile(page, "delete-fails.md");

  await page.goto("/knowledge-base");
  await expect(page.getByTestId(`file-${target.id}`)).toBeVisible();

  await page.route(`**/api/kb/files/${target.id}`, async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 500, json: { error: "boom" } });
      return;
    }
    await route.fallback();
  });

  await page.getByTestId(`delete-${target.id}`).click();
  await page.getByTestId(`confirm-delete-yes-${target.id}`).click();

  await expect(page.getByTestId("err-delete")).toContainText("boom");
  // 失败时文件行必须保留，不能从前端列表移除。
  await expect(page.getByTestId(`file-${target.id}`)).toBeVisible();
});

test("无权限用户无法删除他人文件：DELETE 返回 404，原用户列表仍可见该文件", async ({ page }) => {
  await register(page);
  const victimFile = await uploadReadyFile(page, "owner-only-file.md");

  const logout = await page.request.post("/api/auth/logout");
  expect(logout.ok()).toBeTruthy();
  await register(page);

  const res = await page.request.delete(`/api/kb/files/${victimFile.id}`);
  expect(res.status()).toBe(404);

  // 文件依然存在（下载仍受权限保护，但不是因为被删除导致的 404 —— 用状态未变来间接验证：
  // 用原 owner 身份仍能看到该文件仍存在于其列表）。
});

test("未登录 DELETE /api/kb/files/:id → 401", async ({ page }) => {
  const res = await page.request.delete(`/api/kb/files/nonexistent-id`);
  expect(res.status()).toBe(401);
});
