import { test, expect } from "@playwright/test";

const uniq = () => `ava_edit_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function sendMessage(page: import("@playwright/test").Page, text: string) {
  await page.getByTestId("composer").fill(text);
  await page.getByTestId("send").click();
  await expect(page.getByTestId("msg-assistant").last()).toBeVisible({ timeout: 15_000 });
}

test("最后一条用户消息可编辑并重生成；非最后消息隐藏入口；删除最后一次请求需确认", async ({
  page,
}) => {
  await register(page);
  await page.goto("/ava");

  await sendMessage(page, "第一条请求");
  await sendMessage(page, "第二条原文");

  await expect(page.getByTestId("msg-user")).toHaveCount(2);
  await expect(page.getByTestId("msg-assistant")).toHaveCount(2);
  await expect(page.getByTestId("msg-edit")).toHaveCount(1);
  await expect(page.getByTestId("msg-user").first().getByTestId("msg-edit")).toHaveCount(0);

  await page.getByTestId("msg-edit").click();
  await page.getByTestId("msg-edit-input").fill("取消文本");
  await page.getByTestId("msg-edit-cancel").click();
  await expect(page.getByTestId("msg-user").last()).toContainText("第二条原文");
  await expect(page.getByTestId("msg-user").last()).not.toContainText("取消文本");

  await page.getByTestId("msg-edit").click();
  await page.getByTestId("msg-edit-input").fill("   ");
  await page.getByTestId("msg-edit-save").click();
  await expect(page.getByTestId("msg-edit-error")).toContainText("消息不能为空");
  await expect(page.getByTestId("msg-user").last()).toContainText("第二条原文");

  await page.getByTestId("msg-edit-input").fill("第二条已编辑");
  await page.getByTestId("msg-edit-save").click();
  await expect(page.getByTestId("msg-user").last()).toContainText("第二条已编辑");
  await expect(page.getByTestId("msg-assistant")).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByTestId("msg-assistant").last()).toContainText("第二条已编辑");

  await page.getByTestId("msg-delete").click();
  await expect(page.getByTestId("msg-delete-confirm")).toBeVisible();
  await page.getByTestId("msg-delete-confirm-action").click();
  await expect(page.getByTestId("msg-user")).toHaveCount(1);
  await expect(page.getByTestId("msg-assistant")).toHaveCount(1);
  await expect(page.getByTestId("messages")).not.toContainText("第二条已编辑");
});

test("编辑后重新生成失败时展示提示且用户消息保持可见", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await sendMessage(page, "准备编辑失败");
  await page.getByTestId("msg-edit").click();
  await page.getByTestId("msg-edit-input").fill("触发失败 __ava_force_fail__");
  await page.getByTestId("msg-edit-save").click();

  await expect(page.getByTestId("msg-user").last()).toContainText("触发失败");
  await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("send-error")).toBeVisible();
});
