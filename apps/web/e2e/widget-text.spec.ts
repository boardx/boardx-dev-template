import { test, expect } from "@playwright/test";
import { canvasItems, expectItemCount } from "./helpers/canvas";

// p6:F12：文本组件 + 文本样式 + 文本转便利贴
// - uc-widgets-007（使用文本组件）：创建独立文本并编辑，复用 board-menu-003 已落地的入口。
// - uc-widget-menu-013（编辑文本样式）：字体/字号/加粗/斜体/颜色/对齐。样式编码在 item.color
//   的 "|k=v" 段（见 board-canvas.tsx withStyle/styleGet），经渲染层解析为 fontFamily/fontSize/
//   italic/align 暴露在 window.__canvasTestApi.getItems()。
// - uc-widget-menu-014（文本转便利贴）：Widget Menu 的「转为便利贴」按行/段拆分文本，批量创建
//   便利贴（type:"note"，无文本哨兵），原文本组件保留在画布。

const uniq = () => `wtxt_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function openOwnBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "R" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "C" } })).json()).board;
  await page.goto(`/boards/${board.id}`);
  return board;
}

test("创建文本组件并自动选中，Widget Menu 显示文本样式入口", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await expectItemCount(page, 1);
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expect(page.getByTestId("wm-font")).toBeVisible();
  await expect(page.getByTestId("wm-fontsize")).toBeVisible();
  await expect(page.getByTestId("wm-italic")).toBeVisible();
  await expect(page.getByTestId("wm-align-left")).toBeVisible();
  await expect(page.getByTestId("wm-align-center")).toBeVisible();
  await expect(page.getByTestId("wm-align-right")).toBeVisible();
  await expect(page.getByTestId("wm-convert-to-notes")).toBeVisible();
  // 文本为透明块，不套便签柔彩色（沿用既有约定）
  await expect(page.getByTestId("wm-color-blue")).toHaveCount(0);
});

test("调整字体/字号/斜体/对齐 → 渲染层与持久化均更新（刷新仍在）", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await expectItemCount(page, 1);

  await page.getByTestId("wm-font").selectOption("serif");
  await page.getByTestId("wm-fontsize").selectOption("24");
  await page.getByTestId("wm-italic").click();
  await page.getByTestId("wm-align-right").click();

  await expect.poll(async () => (await canvasItems(page))[0]!.fontFamily).toBe("serif");
  await expect.poll(async () => (await canvasItems(page))[0]!.fontSize).toBe(24);
  await expect.poll(async () => (await canvasItems(page))[0]!.italic).toBe(true);
  await expect.poll(async () => (await canvasItems(page))[0]!.align).toBe("right");

  await expect
    .poll(async () => (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].color as string)
    .toContain("font=serif");

  await page.reload();
  await expectItemCount(page, 1);
  const it = (await canvasItems(page))[0]!;
  expect(it.fontFamily).toBe("serif");
  expect(it.fontSize).toBe(24);
  expect(it.italic).toBe(true);
  expect(it.align).toBe("right");
  // 文本哨兵与字重段不受样式段影响，仍可判别为文本块
  expect((it.color ?? "").split("|")[0]!.split(":")[0]).toBe("text");
});

test("加粗 + 字体/字号共存：color 同时含 :bold 与样式段", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  await page.getByTestId("wm-bold").click();
  await page.getByTestId("wm-fontsize").selectOption("20");
  await expect.poll(async () => (await canvasItems(page))[0]!.bold).toBe(true);
  await expect.poll(async () => (await canvasItems(page))[0]!.fontSize).toBe(20);
  // p6:F19：同一 item 的连续 PATCH 现经串行队列落库（见 board-canvas.tsx queuePatch，修复
  // 快速连续操作时后发先至覆盖新值的真实回归），REST 落库可能略晚于渲染层乐观更新，
  // 用 expect.poll 等待而非单次读取。
  const color = () =>
    page.request.get(`/api/boards/${board.id}/items`).then((r) => r.json()).then((j) => j.items[0].color as string);
  await expect.poll(color).toContain(":bold");
  await expect.poll(color).toContain("size=20");
});

test("文本转便利贴：按行拆分为多个便利贴，原文本保留", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  const id = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].id;
  await page.request.patch(`/api/board-items/${id}`, { data: { text: "第一行\n第二行\n\n第三段" } });

  await page.getByTestId("wm-convert-to-notes").click();

  // 原文本 + 3 条便利贴 = 4 个 item
  await expectItemCount(page, 4);
  const items = await canvasItems(page);
  const notes = items.filter((it) => it.kind === "note");
  expect(notes.length).toBe(3);
  expect(notes.map((n) => n.text).sort()).toEqual(["第一行", "第三段", "第二行"].sort());
  // 原文本组件仍在（异常/主流程都不要求删除原文本）
  expect(items.some((it) => it.kind === "text" && it.text === "第一行\n第二行\n\n第三段")).toBe(true);
  // 新便利贴按多选态展示
  await expect(page.getByTestId("selection-count")).toHaveText("已选 3");

  await page.reload();
  await expectItemCount(page, 4);
});

test("空文本转便利贴：不创建便利贴，保留原文本组件", async ({ page }) => {
  const board = await openOwnBoard(page);
  await page.getByTestId("add-text").click();
  // add-text 的创建 POST 是异步触发（点击本身不等待），直接紧跟着读 REST 存在与创建请求的
  // 竞态（预先存在的缺陷，与本轮改动无关）；用渲染层 expectItemCount 确认已落库再读 REST。
  await expectItemCount(page, 1);
  const id = (await (await page.request.get(`/api/boards/${board.id}/items`)).json()).items[0].id;
  await page.request.patch(`/api/board-items/${id}`, { data: { text: "   \n\n  " } });

  await page.getByTestId("wm-convert-to-notes").click();
  // 仍只有原文本组件，未创建便利贴
  await expect(page.getByTestId("selection-count")).toHaveText("已选 1");
  await expectItemCount(page, 1);
  expect((await canvasItems(page))[0]!.kind).toBe("text");
});

test("便签也可调整文本样式（含文字对象共用样式面板）；形状不显示", async ({ page }) => {
  await openOwnBoard(page);
  await page.getByTestId("add-note").click();
  await expect(page.getByTestId("wm-font")).toBeVisible();
  await expect(page.getByTestId("wm-align-center")).toBeVisible();
  // 转便利贴入口仅对文本显示（便签本身不是待拆分的文本对象）
  await expect(page.getByTestId("wm-convert-to-notes")).toHaveCount(0);

  await page.getByTestId("board-tool-select").click();
  await page.getByTestId("board-tool-shape").click();
  await expect(page.getByTestId("wm-font")).toHaveCount(0);
});
