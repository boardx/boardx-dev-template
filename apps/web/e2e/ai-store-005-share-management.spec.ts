import { test, expect } from "@playwright/test";

// uc-ai-store-005：项目分享管理（授权链接生成/关闭 + 已授权用户列表）。
// 拥有者生成/关闭管理授权链接；被授权协作者通过链接进入 Authorized 视图；
// 关闭链接后旧链接立即失效；非拥有者不能开关分享。

const uniq = (tag: string) => `as5_${tag}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndLogin(page: import("@playwright/test").Page, email: string) {
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function publishOwnedItem(page: import("@playwright/test").Page, name: string) {
  await page.goto("/ai-store");
  await page.getByTestId("nav-create").click();
  await expect(page.getByTestId("create-view")).toBeVisible();
  await page.getByTestId("field-name").fill(name);
  await page.getByTestId("field-description").fill("Share management test item.");
  await page.getByTestId("field-config").fill("Some config instructions for the test agent.");
  await page.getByTestId("field-scope").selectOption("personal");
  await page.getByTestId("action-publish").click();
  await expect(page.getByTestId("saved")).toContainText("已发布");

  await page.getByTestId("nav-authorized").click();
  await expect(page.getByTestId("authorized-view")).toBeVisible();
  const card = page.getByTestId("owner-items").locator(`article:has-text("${name}")`);
  await expect(card).toBeVisible();
  const cardTestId = await card.getAttribute("data-testid");
  const itemId = Number(cardTestId!.replace("owner-item-", ""));
  return itemId;
}

test("未登录调用分享管理接口返回未授权", async ({ page }) => {
  await page.context().clearCookies();
  const res = await page.request.post("/api/ai-store/items/1/share");
  expect(res.status()).toBe(401);
});

test("拥有者生成授权链接、关闭后旧链接失效、重新生成开启新链接", async ({ page }) => {
  const ownerEmail = uniq("owner1");
  await registerAndLogin(page, ownerEmail);
  const name = `Share Owner Item ${Date.now()}`;
  const itemId = await publishOwnedItem(page, name);

  // 分享入口只在符合条件的卡片上展示（notes 范围：非草稿/非拒绝态才展示）。
  const shareBtn = page.getByTestId(`share-item-${itemId}`);
  await expect(shareBtn).toBeVisible();
  await shareBtn.click();

  const modal = page.getByTestId("share-modal");
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId("share-status")).toHaveText("OFF");

  // 生成链接 → 复制到剪贴板并提示已复制；分享开启。
  await modal.getByTestId("share-copy-link").click();
  await expect(modal.getByTestId("share-message")).toContainText("已复制");
  await expect(modal.getByTestId("share-status")).toHaveText("SHARED");
  const linkText = await modal.getByTestId("share-link").textContent();
  expect(linkText).toContain(`/ai-store/share/${itemId}?shareToken=`);
  const token = new URL(linkText!.trim()).searchParams.get("shareToken")!;
  expect(token.length).toBeGreaterThan(10);

  // 服务端校验 token 生效：redeem 接口应成功（不实际用于本用户，仅验证有效性）。
  const validateRes = await page.request.get(`/api/ai-store/items/${itemId}/share`);
  const validateData = (await validateRes.json()) as { share: { share_enabled: boolean; share_token: string } };
  expect(validateData.share.share_enabled).toBe(true);
  expect(validateData.share.share_token).toBe(token);

  // 关闭分享：旧链接立即失效。
  await modal.getByTestId("share-revoke-link").click();
  await expect(modal.getByTestId("share-message")).toContainText("已关闭");
  await expect(modal.getByTestId("share-status")).toHaveText("OFF");

  const revokedRedeem = await page.request.post(`/api/ai-store/items/${itemId}/share/redeem?shareToken=${encodeURIComponent(token)}`);
  expect(revokedRedeem.status()).toBe(404);

  // 重新生成：应拿到一个新 token（旧的已失效，不能被复用）。
  await modal.getByTestId("share-copy-link").click();
  await expect(modal.getByTestId("share-message")).toContainText("重新开启");
  const newLinkText = await modal.getByTestId("share-link").textContent();
  const newToken = new URL(newLinkText!.trim()).searchParams.get("shareToken")!;
  expect(newToken).not.toBe(token);

  await modal.getByTestId("close-share-modal").click();
  await expect(modal).not.toBeVisible();
});

test("非拥有者不能开关分享（服务端拒绝，客户端无入口）", async ({ page, browser }) => {
  const ownerEmail = uniq("owner2");
  await registerAndLogin(page, ownerEmail);
  const name = `Share Guard Item ${Date.now()}`;
  const itemId = await publishOwnedItem(page, name);

  await page.getByTestId(`share-item-${itemId}`).click();
  await page.getByTestId("share-modal").getByTestId("share-copy-link").click();
  await expect(page.getByTestId("share-modal").getByTestId("share-status")).toHaveText("SHARED");

  // 另一个用户尝试直接调用分享管理接口（越权尝试），必须被拒绝。
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await registerAndLogin(otherPage, uniq("intruder"));

  const getRes = await otherPage.request.get(`/api/ai-store/items/${itemId}/share`);
  expect(getRes.status()).toBe(404);
  const postRes = await otherPage.request.post(`/api/ai-store/items/${itemId}/share`);
  expect(postRes.status()).toBe(404);
  const delRes = await otherPage.request.delete(`/api/ai-store/items/${itemId}/share`);
  expect(delRes.status()).toBe(404);

  await other.close();
});

test("被授权协作者打开链接后出现在 Authorized 视图，拥有者可移除授权", async ({ page, browser }) => {
  const ownerEmail = uniq("owner3");
  await registerAndLogin(page, ownerEmail);
  const name = `Share Grantee Item ${Date.now()}`;
  const itemId = await publishOwnedItem(page, name);

  await page.getByTestId(`share-item-${itemId}`).click();
  const modal = page.getByTestId("share-modal");
  await modal.getByTestId("share-copy-link").click();
  await expect(modal.getByTestId("share-status")).toHaveText("SHARED");
  await expect(modal.getByTestId("share-grantees-empty")).toBeVisible();
  const linkText = (await modal.getByTestId("share-link").textContent())!.trim();
  const url = new URL(linkText);
  const token = url.searchParams.get("shareToken")!;
  await modal.getByTestId("close-share-modal").click();

  // 协作者：注册、登录，打开分享链接。
  const collaboratorCtx = await browser.newContext();
  const collaboratorPage = await collaboratorCtx.newPage();
  const collaboratorEmail = uniq("collab");
  await registerAndLogin(collaboratorPage, collaboratorEmail);

  await collaboratorPage.goto(`/ai-store/share/${itemId}?shareToken=${encodeURIComponent(token)}`);
  // store-browser.tsx 的着陆态 useEffect 读完 ?nav=/?shared= 后立刻用 history.replaceState
  // 清掉它们（有意为之：不留一次性分享 token 相关参数在地址栏/历史记录里）。断言这段查询串
  // 还留在 URL 上会和这个清理动作产生真实竞态——落地瞬间该 assert 是否恰好抢在
  // replaceState 之前不确定。改成断言清理后的稳定终态（纯 pathname），toHaveURL 的轮询
  // 会等到 replaceState 落地，不再依赖谁先谁后。
  await expect(collaboratorPage).toHaveURL(/\/ai-store$/);
  await expect(collaboratorPage.getByTestId("authorized-view")).toBeVisible();
  await expect(collaboratorPage.getByTestId("share-redeem-notice")).toContainText("已通过分享链接获得该项目的授权访问");

  const authorizedCard = collaboratorPage.getByTestId(`authorized-item-${itemId}`);
  await expect(authorizedCard).toBeVisible();
  await expect(authorizedCard).toContainText(name);
  await expect(collaboratorPage.getByTestId(`authorized-badge-${itemId}`)).toHaveText("AUTHORIZED");

  // 刷新后仍保持授权（不是仅前端临时态）。
  await collaboratorPage.reload();
  await collaboratorPage.getByTestId("nav-authorized").click();
  await expect(collaboratorPage.getByTestId(`authorized-item-${itemId}`)).toBeVisible();

  // 拥有者视角：已授权用户列表里出现该协作者。
  await page.getByTestId(`share-item-${itemId}`).click();
  await expect(modal.getByTestId("share-grantee-list")).toBeVisible();
  const granteeItems = modal.getByTestId("share-grantee-list").locator("li");
  await expect(granteeItems).toHaveCount(1);
  await expect(granteeItems.first()).toContainText("A B");

  // 拥有者移除该协作者授权。
  const removeBtn = modal.locator('[data-testid^="share-remove-grantee-"]');
  await removeBtn.click();
  await expect(modal.getByTestId("share-message")).toContainText("已移除授权");
  await expect(modal.getByTestId("share-grantees-empty")).toBeVisible();

  // 协作者刷新后应从 Authorized 视图消失（授权被移除后失去可见性）。
  await collaboratorPage.reload();
  await collaboratorPage.getByTestId("nav-authorized").click();
  await expect(collaboratorPage.getByTestId("empty-authorized")).toBeVisible();

  await collaboratorCtx.close();
});

test("无效或已关闭的分享链接显示无法访问提示", async ({ page }) => {
  await registerAndLogin(page, uniq("badlink"));
  await page.goto("/ai-store/share/999999?shareToken=not-a-real-token");
  // 同上：?shareError=invalid 会被 store-browser.tsx 立刻 replaceState 清掉，断言清理后的
  // 稳定 pathname，不和清理动作抢时序。
  await expect(page).toHaveURL(/\/ai-store$/);
  await expect(page.getByTestId("share-redeem-notice")).toContainText("分享链接无效");
});
