import { test, expect } from "@playwright/test";

const uniq = () => `as4_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  const email = uniq();
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email, password: "secret123", agreeTerms: true },
  });
  const response = await page.request.post("/api/teams", {
    data: { name: `Favorite Team ${Date.now()}` },
  });
  expect(response.status()).toBe(201);
  return { email, teamId: Number((await response.json()).team.id) };
}

async function createPublishedItem(page: import("@playwright/test").Page, name: string) {
  const response = await page.request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "personal",
      action: "publish",
      name,
      description: "Favorite test resource.",
      config: "Favorite test instructions.",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: number; likes: number; views: number; name: string };
}

async function createApprovedItem(
  page: import("@playwright/test").Page,
  email: string,
  name: string,
) {
  expect((await page.request.post("/api/dev/grant-sysadmin", { data: { email } })).status()).toBe(200);
  const response = await page.request.post("/api/ai-store/items", {
    data: {
      type: "agent",
      scope: "platform",
      action: "submit_review",
      name,
      description: "Approved favorite test resource.",
      config: "Approved favorite test instructions.",
    },
  });
  expect(response.status()).toBe(201);
  const item = (await response.json()).item as { id: number; likes: number; name: string };
  expect((await page.request.post(`/api/admin/ai-store/${item.id}/review`, {
    data: { action: "approve" },
  })).status()).toBe(200);
  return item;
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
  const item = await createPublishedItem(page, `Favorite Card ${Date.now()}`);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  const card = page.getByTestId("item-grid").locator(`article:has-text("${item.name}")`);
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
  const item = await createPublishedItem(page, `Favorite Detail ${Date.now()}`);
  await page.goto("/ai-store");
  await expect(page.getByTestId("item-grid")).toBeVisible();

  const card = page.getByTestId("item-grid").locator(`article:has-text("${item.name}")`);
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

test("收藏按用户和当前 Team 隔离，聚合喜欢数以服务端为准", async ({ page }) => {
  const { email, teamId: firstTeamId } = await register(page);
  const item = await createApprovedItem(page, email, `Favorite Scoped ${Date.now()}`);
  const firstListResponse = await page.request.get(`/api/ai-store/items?q=${encodeURIComponent(item.name)}`);
  expect(firstListResponse.ok()).toBeTruthy();
  const firstList = (await firstListResponse.json()) as {
    items: Array<{ id: number; liked: boolean; likes: number }>;
  };
  const listedItem = firstList.items[0];
  expect(listedItem).toBeDefined();
  expect(listedItem!.liked).toBe(false);

  const firstFavorite = await page.request.post(`/api/ai-store/items/${listedItem!.id}/favorite`);
  expect(firstFavorite.status()).toBe(200);
  expect(await firstFavorite.json()).toMatchObject({ favorited: true, likes: listedItem!.likes + 1 });

  const secondTeamResponse = await page.request.post("/api/teams", {
    data: { name: `Favorite Second Team ${Date.now()}` },
  });
  expect(secondTeamResponse.status()).toBe(201);
  const secondTeamId = Number((await secondTeamResponse.json()).team.id);
  expect(secondTeamId).not.toBe(firstTeamId);

  const secondTeamList = (await (await page.request.get(
    `/api/ai-store/items?q=${encodeURIComponent(item.name)}`,
  )).json()) as {
    items: Array<{ id: number; liked: boolean; likes: number }>;
  };
  const secondTeamItem = secondTeamList.items.find((candidate) => Number(candidate.id) === Number(listedItem!.id));
  expect(secondTeamItem).toMatchObject({ liked: false, likes: listedItem!.likes + 1 });

  const secondFavorite = await page.request.post(`/api/ai-store/items/${listedItem!.id}/favorite`);
  expect(await secondFavorite.json()).toMatchObject({ favorited: true, likes: listedItem!.likes + 2 });

  expect((await page.request.post("/api/teams/current", {
    data: { teamId: firstTeamId },
  })).status()).toBe(200);
  expect(await (await page.request.post(`/api/ai-store/items/${listedItem!.id}/favorite`)).json())
    .toMatchObject({ favorited: false, likes: listedItem!.likes + 1 });

  expect((await page.request.post("/api/teams/current", {
    data: { teamId: secondTeamId },
  })).status()).toBe(200);
  expect(await (await page.request.post(`/api/ai-store/items/${listedItem!.id}/favorite`)).json())
    .toMatchObject({ favorited: false, likes: listedItem!.likes });
});

test("只有可见资源的成功详情访问才增加浏览统计", async ({ page }) => {
  const { teamId: originTeamId } = await register(page);
  const created = await createPublishedItem(page, `View Counter Agent ${Date.now()}`);

  const visibleDetail = await page.request.get(`/api/ai-store/items/${created.id}`);
  expect(visibleDetail.status()).toBe(200);
  expect((await visibleDetail.json()).item.views).toBe(created.views + 1);

  const otherTeamResponse = await page.request.post("/api/teams", {
    data: { name: `View Counter Other Team ${Date.now()}` },
  });
  expect(otherTeamResponse.status()).toBe(201);
  expect((await page.request.get(`/api/ai-store/items/${created.id}`)).status()).toBe(404);

  expect((await page.request.post("/api/teams/current", {
    data: { teamId: originTeamId },
  })).status()).toBe(200);
  const owned = (await (await page.request.get("/api/ai-store/items?owner=me")).json()).items as Array<{
    id: number;
    views: number;
  }>;
  expect(owned.find((item) => Number(item.id) === Number(created.id))?.views).toBe(created.views + 1);
});

test("收藏请求失败时卡片乐观状态和计数会回滚", async ({ page }) => {
  await register(page);
  const item = await createPublishedItem(page, `Favorite Rollback ${Date.now()}`);
  await page.goto("/ai-store");
  const card = page.getByTestId("item-grid").locator(`article:has-text("${item.name}")`);
  const id = (await card.getAttribute("data-testid"))!.replace("item-", "");
  const favorite = page.getByTestId(`favorite-${id}`);
  const likes = page.getByTestId(`likes-${id}`);
  const initialPressed = await favorite.getAttribute("aria-pressed");
  const initialLikes = await likes.textContent();

  await page.route(`**/api/ai-store/items/${id}/favorite`, async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"failed"}' });
  });
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", initialPressed!);
  await expect(likes).toHaveText(initialLikes!);
});

test("并发 toggle 不会让 likes 计数与收藏明细漂移（CTE 绑定回归）", async ({ page }) => {
  await register(page);
  const item = await createPublishedItem(page, `Favorite Concurrent ${Date.now()}`);
  const itemId = item.id;
  const initialLikes = item.likes;

  // 同一用户对同一项目并发打两次 POST。修复前的竞态：两个请求都先读到「未收藏」→
  // 都走 INSERT 分支，明细因主键只落一行，但两条 UPDATE likes+1 都执行 → 计数 +2 漂移。
  // 修复后计数由 CTE 与「明细行真的插入/删除」绑定，任何交错下都满足不变量：
  // likes 增量 == 最终是否收藏（true→+1，false→0）。
  await Promise.all([
    page.request.post(`/api/ai-store/items/${itemId}/favorite`),
    page.request.post(`/api/ai-store/items/${itemId}/favorite`),
  ]);

  const detailRes = await page.request.get(`/api/ai-store/items/${itemId}`);
  expect(detailRes.ok()).toBeTruthy();
  const detail = (await detailRes.json()) as { item: { likes: number; liked: boolean } };
  expect(detail.item.likes - initialLikes).toBe(detail.item.liked ? 1 : 0);

  // 清理：如仍处于收藏态，切回未收藏，保证种子项计数回到初始，供后续重复跑。
  if (detail.item.liked) {
    const res = await page.request.post(`/api/ai-store/items/${itemId}/favorite`);
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as { favorited: boolean; likes: number };
    expect(data.favorited).toBe(false);
    expect(data.likes).toBe(initialLikes);
  }
});
