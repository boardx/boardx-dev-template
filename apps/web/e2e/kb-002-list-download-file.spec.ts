import { test, expect, type Page } from "@playwright/test";
import { closePool, setKbFileStatus } from "@repo/data";

// uc-kb-002-list-download-file 验收契约。
// 覆盖：列表按 scope/权限过滤、名称搜索、分页/加载更多、刷新、ready 文件下载 URL、失败重试。

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

test("列表支持分页、搜索、刷新，并对 ready 文件返回鉴权下载 URL", async ({ page }) => {
  await register(page);

  for (let i = 0; i < 6; i += 1) {
    await uploadReadyFile(page, `alpha-page-${i}.md`);
  }
  const target = await uploadReadyFile(page, "unique-target-report.pdf", "download me");

  await page.goto("/knowledge-base");
  await expect(page.getByTestId("loading")).toBeVisible();
  await expect(page.getByTestId("file-list")).toBeVisible();
  await expect(page.getByTestId("file-count")).toHaveText("Showing 5 of 7");
  await expect(page.getByTestId("file-list")).toContainText("unique-target-report.pdf");
  await expect(page.getByTestId("load-more")).toBeVisible();

  await page.getByTestId("load-more").click();
  await expect(page.getByTestId("file-count")).toHaveText("Showing 7 of 7");
  await expect(page.getByTestId("file-list")).toContainText("alpha-page-0.md");

  await page.getByTestId("search").fill("unique-target");
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId("file-count")).toHaveText("Showing 1 of 1");
  await expect(page.getByTestId("file-list")).toContainText("unique-target-report.pdf");
  await expect(page.getByTestId("file-list")).not.toContainText("alpha-page-0.md");

  const fresh = await uploadReadyFile(page, "fresh-refresh-note.md");
  await page.getByTestId("search").fill("");
  await page.getByTestId("refresh").click();
  await expect(page.getByTestId(`file-${fresh.id}`)).toBeVisible();

  await page.getByTestId("search").fill("unique-target");
  await page.getByTestId("search-btn").click();
  await expect(page.getByTestId(`file-${target.id}`)).toBeVisible();

  const downloadResponsePromise = page.waitForResponse((res) =>
    res.url().includes(`/api/kb/files/${target.id}/download`)
  );
  await page.getByTestId(`download-${target.id}`).click();
  const downloadResponse = await downloadResponsePromise;
  expect(downloadResponse.status()).toBe(200);
  const body = (await downloadResponse.json()) as { downloadUrl?: string; fileName?: string };
  expect(body.fileName).toBe("unique-target-report.pdf");
  expect(body.downloadUrl).toContain("X-Amz-Signature");
  await expect(page.getByTestId("download-message")).toContainText("Download started");
});

test("无权限文件不出现在列表，下载接口也不签发 URL", async ({ page }) => {
  await register(page);
  const privateFile = await uploadReadyFile(page, "owner-only-secret.md");

  const logout = await page.request.post("/api/auth/logout");
  expect(logout.ok()).toBeTruthy();
  await register(page);
  await page.goto("/knowledge-base");

  await expect(page.getByTestId("file-list")).toHaveCount(0);
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByText("owner-only-secret.md")).toHaveCount(0);

  const denied = await page.request.get(`/api/kb/files/${privateFile.id}/download`);
  expect(denied.status()).toBe(404);
});

test("列表加载失败时展示 retry，重试后恢复", async ({ page }) => {
  await register(page);
  await uploadReadyFile(page, "retry-visible.md");

  let failedOnce = false;
  await page.route("**/api/kb/files?**", async (route) => {
    if (!failedOnce) {
      failedOnce = true;
      await route.fulfill({ status: 500, json: { error: "boom" } });
      return;
    }
    await route.fallback();
  });

  await page.goto("/knowledge-base");
  await expect(page.getByTestId("err")).toContainText("加载失败");
  await page.getByTestId("retry").click();
  await expect(page.getByTestId("file-list")).toContainText("retry-visible.md");
});
