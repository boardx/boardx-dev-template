import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { canvasItems, clickItem, dblclickItem, expectItemCount, selectedIds, waitForCanvasReady } from "./helpers/canvas";

// p7:F12（uc-board-menu-011 创建链接组件，issue #288）：
// Board Menu「链接」入口 → URL 输入面板（空/格式不可用就地提示）→ 画布出现链接卡片
// （text=域名、kind=link、color 哨兵 "link|url=<encodeURIComponent(URL)>"）→ 双击 /
// Widget Menu「打开链接」在新标签打开 → 可移动/删除 → 刷新后哨兵仍判别为链接。
// URL 刻意携带 "|" 与 "="（会撞 color 哨兵的段/键值分隔符），验证 encodeURIComponent
// 编码往返无损（真实风险，不是理论）。

const uniq = () => `link_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
// 指向本应用自身路由的链接（新标签能真实加载，不依赖外网），query 故意含 "|" 和 "="。
const TRICKY_URL = `${BASE_URL}/login?a=1|b=2&c=x=y`;

async function openOwnBoard(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "L", lastName: "K", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Link" } })).json())
    .board;
  // 预置「欢迎引导已关闭」标记，避免引导浮层拦截画布点击。
  await page.addInitScript(() => window.localStorage.setItem("board_welcome_dismissed", "1"));
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  return board;
}

async function createLink(page: Page, url: string) {
  await page.getByTestId("add-link").click();
  await expect(page.getByTestId("board-link-panel")).toBeVisible();
  await page.getByTestId("board-link-url").fill(url);
  await page.getByTestId("board-link-submit").click();
  await expectItemCount(page, 1);
  // 等 color 哨兵落地（POST → PATCH 两步，后台轮询可能先展示无哨兵中间态），
  // 后续交互（双击打开/Widget Menu 判别）都依赖 kind === "link"。
  await expect.poll(async () => (await canvasItems(page))[0]!.kind, { timeout: 10_000 }).toBe("link");
}

test("链接入口 → 输入面板；空 URL 与非法 URL 均就地报错且不创建", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-link").click();
  await expect(page.getByTestId("board-link-panel")).toBeVisible();

  // 空提交 → 提示，不创建
  await page.getByTestId("board-link-submit").click();
  await expect(page.getByTestId("board-link-error")).toBeVisible();
  await expectItemCount(page, 0);

  // 非法格式 → 提示，不创建（uc-board-menu-011 主流程 6：格式不可用时提示修改）
  await page.getByTestId("board-link-url").fill("not a valid url");
  await page.getByTestId("board-link-submit").click();
  await expect(page.getByTestId("board-link-error")).toBeVisible();
  await expectItemCount(page, 0);
});

test("输入合法 URL → 画布出现链接卡片（域名文本 + link 哨兵），URL 含 |/= 时编码往返无损", async ({ page }) => {
  await openOwnBoard(page);
  await createLink(page, TRICKY_URL);
  await expectItemCount(page, 1);
  // 组件先经 POST 落库、随后 PATCH 写入 color 哨兵；后台 1.5s 轮询可能先展示无哨兵的
  // 中间态快照，这里 poll 等待哨兵到位（与真实用户在同一个同步周期内看到的最终态一致）。
  await expect.poll(async () => (await canvasItems(page))[0]!.kind, { timeout: 10_000 }).toBe("link");
  const it = (await canvasItems(page))[0]!;
  expect(it.text).toBe("localhost"); // 卡片展示域名
  expect(it.linkUrl).toBe(TRICKY_URL); // "|" 和 "=" 经 encodeURIComponent 往返无损
  expect(it.color).toContain("link|url=");
  expect(it.type).toBe("note"); // 服务端白名单只放行 note/rect，链接以 note 落库
  // 创建后自动选中
  expect(await selectedIds(page)).toContain(it.id);

  // 刷新后哨兵仍在，仍判别为链接（持久化在 color，非本地状态）
  await page.reload();
  await waitForCanvasReady(page);
  await expectItemCount(page, 1);
  const after = (await canvasItems(page))[0]!;
  expect(after.kind).toBe("link");
  expect(after.linkUrl).toBe(TRICKY_URL);
});

test("双击链接卡片 → 在新标签打开目标 URL", async ({ page, context }) => {
  await openOwnBoard(page);
  await createLink(page, TRICKY_URL);
  await expectItemCount(page, 1);
  const id = (await canvasItems(page))[0]!.id;
  const popupPromise = context.waitForEvent("page");
  await dblclickItem(page, id);
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(popup.url()).toBe(TRICKY_URL);
  await popup.close();
});

test("选中链接 → Widget Menu 显示「打开链接」，点击在新标签打开", async ({ page, context }) => {
  await openOwnBoard(page);
  await createLink(page, TRICKY_URL);
  await expectItemCount(page, 1);
  const id = (await canvasItems(page))[0]!.id;
  await clickItem(page, id);
  await expect(page.getByTestId("wm-open-link")).toBeVisible();
  // 链接卡片不展示柔彩色板（setColor 会破坏 link 判别头）
  await expect(page.getByTestId("wm-color-blue")).toHaveCount(0);
  const popupPromise = context.waitForEvent("page");
  await page.getByTestId("wm-open-link").click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  expect(popup.url()).toBe(TRICKY_URL);
  await popup.close();
});

test("链接组件可移动（方向键微移）、可删除", async ({ page }) => {
  await openOwnBoard(page);
  await createLink(page, TRICKY_URL);
  await expectItemCount(page, 1);
  const it = (await canvasItems(page))[0]!;
  await clickItem(page, it.id);
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await canvasItems(page))[0]!.x).toBe(it.x + 1);
  await page.keyboard.press("Delete");
  await expectItemCount(page, 0);
});

// stored XSS 回归（PR #455 review）：攻击者不经 UI，直接 PATCH 把 link 哨兵的 url 段
// 改成 javascript: 载荷。服务端 isColorSafe 守门必须 400 拒绝、color 保持不变；
// 正常 https PATCH 仍 200。若守门缺失，恶意 color 会落库，其他用户点击「打开链接」
// 时在其会话执行脚本。
test("恶意 PATCH 注入 javascript: 链接被服务端拒绝（400，color 不变）", async ({ page }) => {
  await openOwnBoard(page);
  await createLink(page, TRICKY_URL);
  const it = (await canvasItems(page))[0]!;
  const safeColor = it.color!;
  expect(safeColor).toContain("link|url=");

  // 恶意注入：javascript: 载荷（encodeURIComponent 后塞进 url 段）
  const evil = `link|url=${encodeURIComponent("javascript:alert(document.cookie)")}`;
  const res = await page.request.patch(`/api/board-items/${it.id}`, { data: { color: evil } });
  expect(res.status()).toBe(400);

  // REST 读回：color 未被篡改（仍是原安全值）
  const board = page.url().split("/boards/")[1]!.split(/[/?#]/)[0]!;
  const items = (await (await page.request.get(`/api/boards/${board}/items`)).json()).items as Array<{
    id: string;
    color: string | null;
  }>;
  expect(items.find((x) => x.id === it.id)!.color).toBe(safeColor);

  // data: 载荷同样被拒
  const evilData = `link|url=${encodeURIComponent("data:text/html,<script>alert(1)</script>")}`;
  expect((await page.request.patch(`/api/board-items/${it.id}`, { data: { color: evilData } })).status()).toBe(400);

  // 正常 https 改写仍 200（守门不误伤合法链接）
  const okColor = `link|url=${encodeURIComponent(`${BASE_URL}/login?x=1`)}`;
  const okRes = await page.request.patch(`/api/board-items/${it.id}`, { data: { color: okColor } });
  expect(okRes.status()).toBe(200);
  const items2 = (await (await page.request.get(`/api/boards/${board}/items`)).json()).items as Array<{
    id: string;
    color: string | null;
  }>;
  expect(items2.find((x) => x.id === it.id)!.color).toBe(okColor);

  // 非链接哨兵不受守门影响（回归：便签色 PATCH 仍 200）
  expect((await page.request.patch(`/api/board-items/${it.id}`, { data: { color: "blue" } })).status()).toBe(200);
});
