import { expect, test } from "@playwright/test";

const uniq = () => `fb_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

test("提交反馈：空内容阻止提交，填写内容和图片后成功", async ({ page }) => {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Faye", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });

  await page.goto("/home");
  await page.getByTestId("feedback-entry").click();
  await expect(page.getByRole("dialog", { name: "提交反馈" })).toBeVisible();

  await page.getByRole("button", { name: "提交", exact: true }).click();
  await expect(page.getByTestId("err-feedback")).toHaveText("请先填写反馈内容");

  await page.getByTestId("feedback-message").fill("希望支持更快的反馈处理流程。");
  await page.getByTestId("feedback-file-input").setInputFiles({
    name: "screenshot.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgo=", "base64"),
  });
  await expect(page.getByTestId("feedback-attachments")).toContainText("screenshot.png");

  const responsePromise = page.waitForResponse((res) => (
    res.url().includes("/api/feedback") && res.request().method() === "POST"
  ));
  await page.getByRole("button", { name: "提交", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  await expect(page.getByRole("dialog", { name: "提交反馈" })).toBeHidden();
  await expect(page.getByTestId("feedback-success")).toHaveText("提交成功");
});
