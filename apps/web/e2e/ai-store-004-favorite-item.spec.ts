import { test, expect } from "@playwright/test";

const uniq = () => `as4_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

test("未登录调用 POST /api/ai-store/items/:id/favorite 返回未授权", async ({ page, request }) => {
  await page.context().clearCookies();
  const res = await request.post("/api/ai-store/items/1/favorite");
  expect(res.status()).toBe(401);
});

test("未登录访问 /ai-store 重定向到登录（引导登录后才能点喜欢）", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/ai-store");
  await expect(page).toHaveURL(/\/login/);
});

test("卡片心形高亮切换 + 计数更新，刷新后保持", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  const card = page.getByTestId("item-grid").locator('article:has-text("Research Agent")');
  const cardId = await card.getAttribute("data-testid");
  const id = cardId!.replace("item-", "");

  const favBtn = page.getByTestId(`favorite-${id}`);
  const likesLabel = page.getByTestId(`likes-${id}`);

  await expect(favBtn).toHaveAttribute("aria-pressed", "false");
  const initialLikes = Number(await likesLabel.textContent());

  await favBtn.click();
  await expect(favBtn).toHaveAttribute("aria-pressed", "true");
  await expect(likesLabel).toHaveText(String(initialLikes + 1));

  // 点击卡片其余区域仍应打开详情弹窗（心形按钮点击不冒泡触发详情）。
  await expect(page.getByTestId("item-detail-modal")).not.toBeVisible();

  // 刷新后状态从服务端持久化数据重新拉取，喜欢状态与计数保持。
  await page.reload();
  await expect(page.getByTestId("item-grid")).toBeVisible();
  await expect(page.getByTestId(`favorite-${id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(`likes-${id}`)).toHaveText(String(initialLikes + 1));

  // 再次点击取消喜欢，计数回落。
  await page.getByTestId(`favorite-${id}`).click();
  await expect(page.getByTestId(`favorite-${id}`)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId(`likes-${id}`)).toHaveText(String(initialLikes));
});

test("详情弹窗心形与卡片状态同步，切换后计数一致", async ({ page }) => {
  await register(page);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  // 用 featured 项（Summarize，恒在第 1 页），避免因 pagination 排序把非 featured 项挤到第 2 页。
  const card = page.getByTestId("item-grid").locator('article:has-text("Summarize")');
  const cardId = await card.getAttribute("data-testid");
  const id = cardId!.replace("item-", "");

  await card.click();
  const modal = page.getByTestId("item-detail-modal");
  await expect(modal).toBeVisible();

  const detailFav = modal.getByTestId("detail-favorite");
  const detailLikes = modal.getByTestId("detail-likes");
  await expect(detailFav).toHaveAttribute("aria-pressed", "false");
  const initialLikes = Number(await detailLikes.textContent());

  await detailFav.click();
  await expect(detailFav).toHaveAttribute("aria-pressed", "true");
  await expect(detailLikes).toHaveText(String(initialLikes + 1));

  await modal.getByTestId("close-detail").click();
  await expect(modal).not.toBeVisible();

  // 卡片上的心形与计数应与详情弹窗切换后的结果一致。
  await expect(page.getByTestId(`favorite-${id}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId(`likes-${id}`)).toHaveText(String(initialLikes + 1));
});
