import { test, expect, type Page } from "@playwright/test";

const uniq = () => `trf_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

// 04-F14：房间文件 / Studio / 问卷（团队视角）。
// 原 DEFERRED 理由（依赖 File/Canvas 平面）已过时：p10/p12/p13/p22 已交付 Room 内
// Files/Survey/Studio 三个平面，本 spec 锚定"团队房间里三条链路端到端可达"。
async function teamRoom(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "Team", lastName: "Room", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const team = (await (await page.request.post("/api/teams", { data: { name: `TR ${Date.now()}` } })).json()).team;
  const room = (
    await (
      await page.request.post("/api/rooms", { data: { name: `Team Room ${Date.now()}`, visibility: "team", teamId: team.id } })
    ).json()
  ).room;
  return { team, room };
}

test("团队房间内 Files / Survey / Studio 三个 tab 均可进入并渲染", async ({ page }) => {
  const { room } = await teamRoom(page);
  await page.goto(`/rooms/${room.id}/boards`);
  // 数字 id 会被重定向为 public_id（rm_*），等 URL 落定再开始点 tab，避免点击被重定向吞掉。
  await expect(page).toHaveURL(/\/rooms\/rm_[^/]+\/boards$/);
  await expect(page.getByTestId("room-tab-files")).toBeVisible();

  // Files
  await page.getByTestId("room-tab-files").click();
  await expect(page).toHaveURL(/\/rooms\/[^/]+\/files$/);
  await expect(page.getByTestId("room-tab-files")).toHaveAttribute("data-active", "true");

  // Survey
  await page.getByTestId("room-tab-survey").click();
  await expect(page).toHaveURL(/\/rooms\/[^/]+\/surveys$/);
  await expect(page.getByTestId("room-tab-survey")).toHaveAttribute("data-active", "true");

  // Studio
  await page.getByTestId("room-tab-studio").click();
  await expect(page).toHaveURL(/\/rooms\/[^/]+\/studio$/);
  // Studio 是沉浸式全屏工作区（p22 rr-014），脱离房间壳，断言工作区容器。
  await expect(page.getByTestId("room-studio-tab")).toBeVisible();
});
