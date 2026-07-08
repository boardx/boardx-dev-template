// p22/F03 Studio 独立顶级 tab（uc 见 requirements/00-overview.md 优先级2）
// 契约：房间详情 tab 导航恢复六项（含 Studio）；点击进入独立落地页，展示 mock 产物列表
// + 跳转聊天工作区入口；人类已确认本轮维持轻量落地页范围（见 ui-signoff.md）。
import { test, expect, type Page } from "@playwright/test";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: Page, prefix: string): Promise<string> {
  const email = uniq(prefix);
  const res = await page.request.post("/api/auth/register", {
    data: { firstName: "U", lastName: prefix, email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBe(true);
  return email;
}

async function createRoom(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/rooms", { data: { name, visibility: "private" } });
  const d = await res.json();
  return d.room.id as number;
}

test("房间详情 tab 导航含六项，Studio 可独立到达", async ({ page }) => {
  await register(page, "studiotab1");
  const roomId = await createRoom(page, "Studio Room");

  await page.goto(`/rooms/${roomId}/boards`);
  for (const t of ["boards", "members", "files", "chat", "survey", "studio"]) {
    await expect(page.getByTestId(`room-tab-${t}`)).toBeVisible();
  }

  await page.getByTestId("room-tab-studio").click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/studio$`));
  await expect(page.getByTestId("room-tab-studio")).toHaveAttribute("data-active", "true");
});

test("Studio 落地页展示 mock 产物列表 + 跳转聊天工作区入口", async ({ page }) => {
  await register(page, "studiotab2");
  const roomId = await createRoom(page, "Studio Room 2");

  await page.goto(`/rooms/${roomId}/studio`);
  await expect(page.getByTestId("room-studio-tab")).toBeVisible();
  await expect(page.getByTestId("room-studio-artifact-list")).toBeVisible();
  const items = page.getByTestId("room-studio-artifact-list").locator("li");
  await expect(items).toHaveCount(3);

  await page.getByTestId("room-studio-open-in-chat").click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${roomId}/chats$`));
});
