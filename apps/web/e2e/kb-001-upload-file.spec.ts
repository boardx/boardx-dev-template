import { test, expect } from "@playwright/test";

// uc-kb-001-upload-file 验收契约（TDD）。
// 覆盖：登录后空状态 + 上传控件 → 上传后出现在列表；未登录 → 跳登录。

const uniq = () => `kb_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("登录后 /knowledge-base：空状态 + 上传控件，上传文件后出现在列表", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");

  // 空状态可见
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("empty")).toContainText("No files yet");

  // 上传控件（入口按钮 + 隐藏 file input）存在
  await expect(page.getByTestId("upload-trigger")).toBeVisible();
  await expect(page.getByTestId("file-input")).toBeAttached();

  // 通过隐藏的 file input 选择一个文件 → 自动上传（桩化，仅元数据）
  await page.getByTestId("file-input").setInputFiles({
    name: "spec-notes.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("hello knowledge base"),
  });

  // 上传完成后文件出现在列表
  await expect(page.getByTestId("file-list")).toBeVisible();
  await expect(page.getByTestId("file-list")).toContainText("spec-notes.pdf");
  await expect(page.getByTestId("empty")).toHaveCount(0);
});

test("校验：不支持的文件类型进入队列 error 行", async ({ page }) => {
  await register(page);
  await page.goto("/knowledge-base");
  await expect(page.getByTestId("empty")).toBeVisible();

  await page.getByTestId("file-input").setInputFiles({
    name: "virus.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("nope"),
  });

  // 出现错误状态的队列项，且列表仍为空
  await expect(page.getByTestId("queue-item-error")).toBeVisible();
  await expect(page.getByTestId("empty")).toBeVisible();
});

test("未登录访问 /knowledge-base → 跳登录", async ({ page }) => {
  await page.goto("/knowledge-base");
  await expect(page).toHaveURL(/\/login/);
});
