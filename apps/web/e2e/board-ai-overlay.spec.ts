import { expect, test } from "@playwright/test";

// F01（uc-board-ai-001）：Board 内嵌 AI 浮层 + 底部工具 dock + board chat 面板。
// 端到端覆盖 user_visible_behavior：
//  1. 打开 Board 后，底部悬浮工具 dock 可见可用（FigJam 风格，含 Ask AI 触发按钮）。
//  2. AI 浮层可唤起（右下角圆形触发按钮），唤起后 board chat 面板停靠展示（空态 → 提问 → AI 回复）。
//  3. 面板可收起，dock 上的 Ask AI 按钮与浮层触发按钮共享同一开关状态。
//  4. 通过底部 dock 新建的组件真实出现在画布上（dock 与画布真值一致，非视觉贴图）。
//  5.（F01 复审修正）AI 回复真实基于当前画布内容生成：断言回复中包含画布上某个具体便签的
//     真实文字内容，而非断言写死的模板文案 —— 证明 POST /api/boards/:id/ai-chat 确实把
//     画布 items 的文字传给了 CAP-AI 网关（见 board-ai-panel.tsx / route.ts 的改动）。

const uniq = () => `bai_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createBoard(page: import("@playwright/test").Page, name = "AI Overlay Board") {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "AI Overlay Room" } })).json()).room;
  const board = (await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name } })).json()).board;
  return { room, board };
}

test("底部工具 dock 可见可用，Ask AI 唤起 board chat 面板并可基于画布真实内容问答", async ({ page }) => {
  const { board } = await createBoard(page);

  // 画布上预先放一张带有独特文字内容的便签，作为"AI 回复真实基于画布内容生成"的可判定依据。
  const distinctiveText = `预算方案-Q3-${Math.floor(Math.random() * 1e6)}`;
  await page.request.post(`/api/boards/${board.id}/items`, {
    data: { type: "note", x: 40, y: 40, text: distinctiveText },
  });

  await page.goto(`/boards/${board.id}`);

  await expect(page.getByTestId("canvas-viewport")).toBeVisible();

  // 底部悬浮工具 dock：FigJam 风格，取代/补充顶部单行工具条
  const dock = page.getByTestId("board-bottom-dock");
  await expect(dock).toBeVisible();
  await expect(dock.getByTestId("dock-tool-select")).toBeVisible();
  await expect(dock.getByTestId("dock-tool-sticky")).toBeVisible();
  await expect(dock.getByTestId("dock-tool-ask-ai")).toBeVisible();

  // AI 浮层触发按钮（右下角圆形），初始未展开
  await expect(page.getByTestId("board-ai-toggle")).toBeVisible();
  await expect(page.getByTestId("board-ai-panel")).toHaveCount(0);

  // 从底部 dock 的 Ask AI 唤起 board chat 面板（与浮层触发按钮共享同一开关状态）
  await dock.getByTestId("dock-tool-ask-ai").click();
  const panel = page.getByTestId("board-ai-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("board-ai-toggle")).toHaveAttribute("aria-pressed", "true");

  // 空态：尚无消息时的引导文案（U2）
  await expect(panel.getByTestId("empty")).toBeVisible();

  // 就当前画布内容提问 → 发送 → 出现 sending/loading 态 → 最终收到 AI 回复，
  // 且回复内容真实包含画布上那张便签的文字（证明是基于画布内容生成，非写死模板）。
  await panel.getByTestId("board-ai-composer").fill("总结一下这个画布");
  await panel.getByTestId("board-ai-send").click();

  await expect(panel.getByTestId("board-ai-msg-user")).toContainText("总结一下这个画布");
  await expect(panel.getByTestId("board-ai-msg-ai")).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByTestId("board-ai-msg-ai")).toContainText(distinctiveText);

  // 再追问一次，验证消息持续累积（真实对话，而非一次性 mock），且依旧基于画布内容作答。
  await panel.getByTestId("board-ai-composer").fill("再帮我生成一个方案");
  await panel.getByTestId("board-ai-send").click();
  await expect(panel.getByTestId("board-ai-msg-user")).toHaveCount(2);
  await expect(panel.getByTestId("board-ai-msg-ai")).toHaveCount(2, { timeout: 10_000 });
  await expect(panel.getByTestId("board-ai-msg-ai").nth(1)).toContainText(distinctiveText);

  // 收起面板：右下角触发按钮和面板内的关闭按钮都能收起，且状态互通
  await panel.getByTestId("board-ai-close").click();
  await expect(page.getByTestId("board-ai-panel")).toHaveCount(0);
  await expect(page.getByTestId("board-ai-toggle")).toHaveAttribute("aria-pressed", "false");
});

test("从底部 dock 新建便签：dock 与画布内容真值一致", async ({ page }) => {
  const { board } = await createBoard(page, "AI Overlay Board Sticky");
  await page.goto(`/boards/${board.id}`);

  const dock = page.getByTestId("board-bottom-dock");
  await expect(dock).toBeVisible();

  const itemsBefore = await page.getByTestId("items-layer").locator("[data-testid^='item-']").count();
  await dock.getByTestId("dock-tool-sticky").click();
  await expect(page.getByTestId("items-layer").locator("[data-testid^='item-']")).toHaveCount(itemsBefore + 1);

  // AI 浮层的头部展示当前画布组件数（"就当前画布内容"提问的可见依据）
  await page.getByTestId("board-ai-toggle").click();
  await expect(page.getByTestId("board-ai-panel")).toContainText(`${itemsBefore + 1} 个组件`);
});

test("无编辑权限（仅查看）时底部工具 dock 不展示，但 AI 浮层仍可用于提问", async ({ page, browser }) => {
  const { board } = await createBoard(page, "AI Overlay Board Viewer");
  await page.request.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`/boards/${board.id}`);

  await expect(viewerPage.getByTestId("canvas-viewport")).toBeVisible();
  await expect(viewerPage.getByTestId("board-bottom-dock")).toHaveCount(0);
  await expect(viewerPage.getByTestId("board-ai-toggle")).toBeVisible();

  await viewerPage.getByTestId("board-ai-toggle").click();
  await expect(viewerPage.getByTestId("board-ai-panel")).toBeVisible();
  await expect(viewerPage.getByTestId("empty")).toBeVisible();

  await viewerContext.close();
});
