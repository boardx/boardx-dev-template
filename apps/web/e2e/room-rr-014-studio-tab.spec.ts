// p22 Studio 全屏三栏工作区（uc 见 requirements/00-overview.md 优先级2）
// 契约：房间详情 tab 导航含六项（含 Studio）；点 Studio tab 进入沉浸式全屏工作区——
// 脱离房间壳（无左侧房间列表、无房间头部/六 tab），三栏布局（左房间文件 sources /
// 中产物区 / 右生成配置面板），顶部「返回房间」导航回房间 Boards tab。
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

test("房间详情 tab 导航含六项；点 Studio tab 进入全屏工作区（脱离房间壳与双栏）", async ({ page }) => {
  await register(page, "studiotab1");
  const roomId = await createRoom(page, "Studio Room");

  await page.goto(`/rooms/${roomId}/boards`);
  for (const t of ["boards", "members", "files", "chat", "survey", "studio"]) {
    await expect(page.getByTestId(`room-tab-${t}`)).toBeVisible();
  }
  // 进入 studio 前，房间壳（六 tab）与双栏（房间列表）都在。
  await expect(page.getByTestId("room-list-panel")).toBeVisible();

  await page.getByTestId("room-tab-studio").click();
  await page.waitForURL(new RegExp(`/rooms/${roomId}/studio$`), { timeout: 20000 });

  // 全屏：Studio 工作区可见，房间壳的六 tab 与左侧房间列表都已脱去。
  await expect(page.getByTestId("room-studio-tab")).toBeVisible();
  await expect(page.getByTestId("room-tab-studio")).toHaveCount(0);
  await expect(page.getByTestId("room-list-panel")).toHaveCount(0);
});

test("Studio 全屏三栏工作区：左房间文件 / 中产物区 / 右生成配置；顶部返回房间", async ({ page }) => {
  await register(page, "studiotab2");
  const roomId = await createRoom(page, "Studio Room 2");

  await page.goto(`/rooms/${roomId}/studio`);
  await expect(page.getByTestId("room-studio-tab")).toBeVisible();

  // 三栏：左房间文件 sources / 中产物区 / 右生成配置面板。
  await expect(page.getByTestId("pane-files")).toBeVisible();
  await expect(page.getByTestId("pane-artifacts")).toBeVisible();
  await expect(page.getByTestId("pane-studio")).toBeVisible();

  // 中栏产物列表（mock，3 项）。
  await expect(page.getByTestId("room-studio-artifact-list").locator("li")).toHaveCount(3);

  // 顶部返回房间 → 回到该房间 Boards tab（重新出现房间壳/双栏）。
  await page.getByTestId("room-studio-back").click();
  await page.waitForURL(new RegExp(`/rooms/${roomId}/boards$`), { timeout: 20000 });
  await expect(page.getByTestId("room-list-panel")).toBeVisible();
});
