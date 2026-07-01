import { test, expect } from "@playwright/test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// uc-kb-001-upload-file 验收契约。
// 覆盖：登录后空状态 + 上传控件 → 上传后出现在列表并推进到 ready；
// 类型/大小校验拒绝；未登录 → 跳登录。
// 真实链路：前端 multipart → POST /api/kb/files → 对象存储(MinIO) + kb_files 表
// → 入队 boardx.kb-file-processing → workflow-worker 回写 processing → ready。

const uniq = () => `kb_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("登录后 /knowledge-base：空状态 + 上传控件，上传文件后出现在列表并最终 ready", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");

  // 空状态可见
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("empty")).toContainText("No files yet");

  // 上传控件（入口按钮 + 隐藏 file input）存在
  await expect(page.getByTestId("upload-trigger")).toBeVisible();
  await expect(page.getByTestId("file-input")).toBeAttached();

  // 通过隐藏的 file input 选择一个文件 → 自动上传（真实 multipart，落对象存储 + kb_files 表）
  await page.getByTestId("file-input").setInputFiles({
    name: "spec-notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("hello knowledge base"),
  });

  // 上传完成后文件出现在列表
  await expect(page.getByTestId("file-list")).toBeVisible();
  await expect(page.getByTestId("file-list")).toContainText("spec-notes.pdf");
  await expect(page.getByTestId("empty")).toHaveCount(0);

  // 异步处理管线（parse/chunk/vectorize 桩）最终把状态从 processing 推进到 ready；
  // 页面每 2s 轮询刷新，这里给足超时等待 worker 消费掉队列任务。
  const statusBadge = page.locator('[data-testid^="file-status-"]').first();
  await expect(statusBadge).toHaveText("ready", { timeout: 30_000 });
});

test("校验：不支持的文件类型进入队列 error 行，且不产生半条记录", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  await page.getByTestId("file-input").setInputFiles({
    name: "virus.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("nope"),
  });

  // 出现错误状态的队列项，且列表仍为空（未产生半条记录）
  await expect(page.getByTestId("queue-item-error")).toBeVisible();
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("校验：超过大小上限的文件进入队列 error 行", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  // 51MB，超过前端 50MB 上限 → 客户端预校验直接拒绝，不发请求。
  // Playwright setInputFiles 的 buffer 选项上限 50MB，改写临时文件后传路径。
  const dir = mkdtempSync(join(tmpdir(), "kb-upload-"));
  const filePath = join(dir, "too-big.pdf");
  writeFileSync(filePath, Buffer.alloc(51 * 1024 * 1024, 1));
  await page.getByTestId("file-input").setInputFiles(filePath);

  await expect(page.getByTestId("queue-item-error")).toBeVisible();
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("服务端二次校验：绕过前端直接 POST 不支持类型 → 400 且不落库", async ({ page, request }) => {
  await register(page);
  // 复用注册后的 cookie（page.request 与 page 共享同一浏览器上下文的 cookie jar）。
  const res = await page.request.post("/api/kb/files", {
    multipart: {
      file: {
        name: "virus.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("nope"),
      },
      scope: "personal",
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.errors?.type).toBeTruthy();
});

test("未登录访问 /knowledge-base → 跳登录", async ({ page }) => {
  await page.goto("/knowledge-base");
  await expect(page).toHaveURL(/\/login/);
});
