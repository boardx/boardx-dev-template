import { test, expect } from "@playwright/test";

// uc-common-004：提交带附件反馈。
// 全局反馈入口（sidebar `feedback-entry`）→ 反馈弹窗 → 填写内容 + 上传图片附件 → 提交 →
// 成功后展示「提交成功」（`feedback-success`），后端把反馈连同 Base64 图片附件记录下来。
// 覆盖：主流程（带附件）+ 备选 A1（仅文字）+ 异常 E1（内容为空阻止提交）+ 权限（未登录 401）。

const uniq = () => `fb_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// 1x1 透明 PNG（最小合法图片），用于 setInputFiles 的内存文件。
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function register(page: import("@playwright/test").Page) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "F", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

test("UI：登录用户填写内容并附带图片，提交后展示成功且后端记录反馈", async ({ page }) => {
  await register(page);
  await page.goto("/");

  // 全局反馈入口在 sidebar（登录后可见）。
  const entry = page.getByTestId("feedback-entry");
  await expect(entry).toBeVisible();
  await entry.click();

  // 弹窗打开：内容输入区 + 图片附件入口。
  const message = page.getByTestId("feedback-message");
  await expect(message).toBeVisible();
  await message.fill("画布拖拽时偶发卡顿，附上截图说明。");

  // 通过隐藏的 file input 直接注入图片附件（Playwright setInputFiles）。
  await page.getByTestId("feedback-file-input").setInputFiles({
    name: "screenshot.png",
    mimeType: "image/png",
    buffer: PNG_1x1,
  });
  // 选中的附件出现在待提交列表里，允许提交前移除/重选。
  await expect(page.getByTestId("feedback-attachments")).toContainText("screenshot.png");

  // 拦截提交请求，断言「反馈被记录」：201 + 返回 feedback.id，且附件带 Base64 image dataUrl。
  const [request, response] = await Promise.all([
    page.waitForRequest((r) => r.url().includes("/api/feedback") && r.method() === "POST"),
    page.waitForResponse((r) => r.url().includes("/api/feedback") && r.request().method() === "POST"),
    page.getByRole("button", { name: "提交", exact: true }).click(),
  ]);

  const sent = request.postDataJSON() as {
    message: string;
    attachments: Array<{ name: string; type: string; dataUrl: string }>;
  };
  expect(sent.attachments).toHaveLength(1);
  expect(sent.attachments[0]!.name).toBe("screenshot.png");
  expect(sent.attachments[0]!.type).toBe("image/png");
  expect(sent.attachments[0]!.dataUrl.startsWith("data:image/png;base64,")).toBe(true);

  expect(response.status()).toBe(201);
  const body = (await response.json()) as { feedback?: { id?: number | string } };
  // pg 的 bigint 主键序列化为字符串；只要拿到非空 id 即表示反馈已落库。
  expect(body.feedback?.id).toBeDefined();
  expect(String(body.feedback?.id).length).toBeGreaterThan(0);

  // 提交成功后弹窗关闭并展示「提交成功」。
  await expect(page.getByTestId("feedback-success")).toBeVisible();
  await expect(page.getByTestId("feedback-success")).toContainText("提交成功");
  await expect(page.getByTestId("feedback-message")).toHaveCount(0);
});

test("UI：反馈内容为空时阻止提交并保持弹窗打开（E1）", async ({ page }) => {
  await register(page);
  await page.goto("/");

  await page.getByTestId("feedback-entry").click();
  await expect(page.getByTestId("feedback-message")).toBeVisible();

  // 不填内容直接提交 → 展示错误提示，弹窗仍在。
  await page.getByRole("button", { name: "提交", exact: true }).click();
  await expect(page.getByTestId("err-feedback")).toBeVisible();
  await expect(page.getByTestId("err-feedback")).toContainText("请先填写反馈内容");
  await expect(page.getByTestId("feedback-message")).toBeVisible();
  // 未触发成功态。
  await expect(page.getByTestId("feedback-success")).toHaveCount(0);
});

test("API：仅文字反馈也能记录（备选 A1，无附件）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/feedback", {
    data: { message: "希望增加快捷键面板。", attachments: [] },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { feedback?: { id?: number | string } };
  expect(body.feedback?.id).toBeDefined();
  expect(String(body.feedback?.id).length).toBeGreaterThan(0);
});

test("API：内容为空返回 400（业务规则：反馈内容必须非空）", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/feedback", {
    data: { message: "   ", attachments: [] },
  });
  expect(res.status()).toBe(400);
});

test("权限：未登录提交反馈返回 401", async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.request.post("/api/feedback", {
    data: { message: "匿名反馈", attachments: [] },
  });
  expect(res.status()).toBe(401);
});
