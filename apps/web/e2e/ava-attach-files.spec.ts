import { test, expect } from "@playwright/test";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// uc-ava-007 验收契约（P9 F08：向聊天附加文件/图片/音频）。
// 覆盖：composer 附件入口 + 拖拽上传 → 预览条上传中/完成/失败/重试/移除 →
// 超数量/类型不支持/超大小给对应提示 → 发送后附件随消息进聊天历史 → AI 基于附件文件名回复。
// 真实链路：前端 multipart → POST /api/ava/threads/:id/attachments → 对象存储(MinIO) +
// ava_message_attachments 表（暂存）→ 发消息时关联到具体 message_id。

const uniq = () => `avaatt_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("composer 附件入口：选择图片 → 预览条展示上传中到完成 → 发送后随消息进入聊天历史，AI 提及文件名", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await expect(page.getByTestId("attachment-trigger")).toBeVisible();
  await expect(page.getByTestId("attachment-input")).toBeAttached();

  await page.getByTestId("attachment-input").setInputFiles({
    name: "cat.png",
    mimeType: "image/png",
    buffer: Buffer.from("fake-png-bytes"),
  });

  // 预览条出现，展示缩略图/文件名；上传完成后不再是 uploading 状态
  await expect(page.getByTestId("attachment-preview-strip")).toBeVisible();
  const previewItem = page.getByTestId("attachment-preview-item").first();
  await expect(previewItem).toHaveAttribute("data-status", "uploaded", { timeout: 30_000 });

  // 只带附件不带文字也能发送（发送按钮不再被禁用）
  await expect(page.getByTestId("send")).toBeEnabled();

  await page.getByTestId("composer").fill("看看这张图");
  await page.getByTestId("send").click();

  // 用户消息带附件一起展示进聊天历史。
  // p18 F10：图片附件渲染为缩略图（msg-attachment-image），文件名不再是可见文本，
  // 改为校验缩略图按钮的 aria-label 与 <img> 的 alt（fake png bytes 加载会 onerror，
  // 但元素与 alt 仍可断言；组件降级只看签名 URL fetch 状态，不看 img onerror）。
  await expect(page.getByTestId("msg-attachments")).toBeVisible();
  const attachmentImage = page
    .getByTestId("msg-attachment-item")
    .getByTestId("msg-attachment-image");
  await expect(attachmentImage).toBeVisible({ timeout: 10_000 });
  await expect(attachmentImage).toHaveAttribute("aria-label", "Preview cat.png");
  await expect(attachmentImage.locator("img")).toHaveAttribute("alt", "cat.png");
  await expect(page.getByTestId("msg-user")).toContainText("看看这张图");

  // 点击缩略图打开 lightbox 放大预览，可关闭
  await attachmentImage.click();
  await expect(page.getByTestId("attachment-lightbox")).toBeVisible();
  await expect(page.getByTestId("attachment-lightbox").locator("img")).toHaveAttribute(
    "alt",
    "cat.png"
  );
  await page.getByTestId("attachment-lightbox-close").click();
  await expect(page.getByTestId("attachment-lightbox")).toHaveCount(0);

  // AI（stub）基于附件上下文回复，引用文件名
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("msg-assistant")).toContainText("cat.png", { timeout: 15_000 });

  // 预览条已在发送后清空
  await expect(page.getByTestId("attachment-preview-strip")).toHaveCount(0);

  // reload 后附件仍随历史消息持久化展示（同样校验缩略图 alt 而非可见文本）
  await page.reload();
  await page
    .getByTestId("thread-list")
    .getByRole("button", { name: /看看这张图/ })
    .first()
    .click();
  const persistedImage = page
    .getByTestId("msg-attachment-item")
    .first()
    .getByTestId("msg-attachment-image");
  await expect(persistedImage).toBeVisible({ timeout: 10_000 });
  await expect(persistedImage.locator("img")).toHaveAttribute("alt", "cat.png");
});

test("拖拽上传：拖一个文件到 composer 区域也能触发上传", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  const dropzone = page.getByTestId("composer-dropzone");
  const buffer = Buffer.from("hello world").toString("base64");

  // Playwright 没有原生拖拽文件 API，通过 DataTransfer + dispatchEvent 模拟浏览器拖放。
  await dropzone.evaluate(
    (el, { name, mime, b64 }) => {
      const byteChars = atob(b64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const file = new File([bytes], name, { type: mime });
      const dt = new DataTransfer();
      dt.items.add(file);
      const event = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dt });
      el.dispatchEvent(event);
    },
    { name: "notes.txt", mime: "text/plain", b64: buffer }
  );

  await expect(page.getByTestId("attachment-preview-strip")).toBeVisible();
  await expect(page.getByTestId("attachment-preview-item").first()).toHaveAttribute(
    "data-status",
    "uploaded",
    { timeout: 30_000 }
  );
});

test("校验：不支持的文件类型 → 预览条展示失败态 + 可读提示，可重试", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("attachment-input").setInputFiles({
    name: "virus.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("nope"),
  });

  const item = page.getByTestId("attachment-preview-item").first();
  await expect(item).toHaveAttribute("data-status", "failed");
  await expect(page.getByTestId("attachment-failed")).toBeVisible();
  await expect(page.getByTestId("attachment-retry")).toBeVisible();
});

test("校验：超过大小上限的文件 → 失败态提示", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  const dir = mkdtempSync(join(tmpdir(), "ava-upload-"));
  const filePath = join(dir, "too-big.png");
  writeFileSync(filePath, Buffer.alloc(21 * 1024 * 1024, 1));
  await page.getByTestId("attachment-input").setInputFiles(filePath);

  const item = page.getByTestId("attachment-preview-item").first();
  await expect(item).toHaveAttribute("data-status", "failed");
  await expect(page.getByTestId("attachment-failed")).toContainText("过大");
});

test("校验：超过数量上限一次性选择 6 个文件 → 拒绝并提示，不触发上传", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  const files = Array.from({ length: 6 }).map((_, i) => ({
    name: `f${i}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(`file ${i}`),
  }));
  await page.getByTestId("attachment-input").setInputFiles(files);

  await expect(page.getByTestId("attachment-queue-error")).toBeVisible();
  await expect(page.getByTestId("attachment-queue-error")).toContainText("5");
  await expect(page.getByTestId("attachment-preview-item")).toHaveCount(0);
});

test("移除附件：上传完成后可移除，移除后不随消息发送", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("attachment-input").setInputFiles({
    name: "remove-me.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("temp"),
  });
  const item = page.getByTestId("attachment-preview-item").first();
  await expect(item).toHaveAttribute("data-status", "uploaded", { timeout: 30_000 });

  await page.getByTestId("attachment-remove").click();
  await expect(page.getByTestId("attachment-preview-strip")).toHaveCount(0);

  // 移除后没有附件也没有文字，发送按钮应保持禁用
  await expect(page.getByTestId("send")).toBeDisabled();
});

test("服务端二次校验：绕过前端直接 POST 不支持类型 → 400 且不落库", async ({ page }) => {
  await register(page);
  const threadRes = await page.request.post("/api/ava/threads");
  const { thread } = await threadRes.json();

  const res = await page.request.post(`/api/ava/threads/${thread.id}/attachments`, {
    multipart: {
      file: {
        name: "virus.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("nope"),
      },
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.errors?.type).toBeTruthy();
});

test("未登录访问附件上传接口 → 401", async ({ page, playwright, baseURL }) => {
  const owner = await playwright.request.newContext({ baseURL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "O", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const thread = (await (await owner.post("/api/ava/threads")).json()).thread;

  const anon = await playwright.request.newContext({ baseURL });
  const res = await anon.post(`/api/ava/threads/${thread.id}/attachments`, {
    multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } },
  });
  expect(res.status()).toBe(401);
  await anon.dispose();
  await owner.dispose();
});
