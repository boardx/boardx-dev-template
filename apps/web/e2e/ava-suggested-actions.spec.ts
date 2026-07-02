import { expect, test } from "@playwright/test";

const uniq = () => `avasuggest_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Ava", lastName: "User", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("建议动作填入 composer，用户可编辑后按普通消息发送，并在回复下方刷新下一步建议", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await expect(page.getByTestId("empty")).toBeVisible();
  const suggestions = page.getByTestId("suggested-actions");
  await expect(suggestions).toBeVisible();
  await expect(page.getByTestId("suggested-action")).toHaveCount(4);

  await page.getByTestId("suggested-action").filter({ hasText: "总结趋势" }).click();
  const composer = page.getByTestId("composer");
  await expect(composer).toHaveValue("帮我总结最近用户反馈中的主要趋势。");
  await expect(composer).toBeFocused();
  await expect(page.getByTestId("msg-user")).toHaveCount(0);

  await composer.fill("帮我总结最近用户反馈中的主要趋势，并给出三个产品动作。");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("suggested-actions")).toHaveCount(0);
  await expect(page.getByTestId("msg-user")).toContainText("三个产品动作");
  await expect(page.getByTestId("msg-assistant")).toBeVisible({ timeout: 15_000 });

  await expect(page.getByTestId("suggested-actions")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("suggested-action")).toHaveCount(3);

  await page.getByTestId("suggested-action").filter({ hasText: "拆成任务" }).click();
  await expect(composer).toHaveValue("把上面的建议拆成可执行任务，并按优先级排序。");
  await composer.fill("把上面的建议拆成可执行任务，并按优先级排序。再补充 owner。");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("msg-user")).toHaveCount(2);
  await expect(page.getByTestId("msg-user").nth(1)).toContainText("owner");
  await expect(page.getByTestId("msg-assistant")).toHaveCount(2, { timeout: 15_000 });
});

test("无可用建议时隐藏建议动作区域：失败回复下方不展示下一步建议", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("composer").fill("触发失败 __ava_force_fail__");
  await page.getByTestId("send").click();

  await expect(page.getByTestId("msg-user")).toContainText("触发失败");
  await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("suggested-actions")).toHaveCount(0);
});
