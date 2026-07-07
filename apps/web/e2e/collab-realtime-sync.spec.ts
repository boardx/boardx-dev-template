import { expect, test, type APIRequestContext, type BrowserContext } from "@playwright/test";
import { canvasItems, clickItem, dblclickItem, expectItemCount } from "./helpers/canvas";

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;

async function register(ctx: APIRequestContext, email: string) {
  const res = await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

async function createBoardPair(browser: { newContext(options: { baseURL: string }): Promise<BrowserContext> }) {
  const ctxA = await browser.newContext({ baseURL: BASE });
  const ctxB = await browser.newContext({ baseURL: BASE });
  const emailA = uniq("syncA");
  const emailB = uniq("syncB");
  await register(ctxA.request, emailA);
  await register(ctxB.request, emailB);
  const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Realtime Sync" } })).json()).room;
  const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Items" } })).json()).board;
  const invite = await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });
  expect(invite.ok()).toBeTruthy();
  return { ctxA, ctxB, room, board };
}

// p6:F13：item 计数/内容/位置锚点迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。

test("协作者通过实时通道看到组件创建、移动、编辑与删除", async ({ browser }) => {
  const { ctxA, ctxB, board } = await createBoardPair(browser);
  try {
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);
    await expectItemCount(pageA, 0);
    await expectItemCount(pageB, 0);

    await pageA.getByTestId("add-note").click();
    await expectItemCount(pageA, 1);
    await expectItemCount(pageB, 1);

    const [noteA] = await canvasItems(pageA);
    const noteId = noteA!.id;
    await expect
      .poll(async () => (await canvasItems(pageB)).find((it) => it.id === noteId)?.text ?? "")
      .toContain("便签");

    const beforeX = noteA!.x;
    await clickItem(pageA, noteId);
    await pageA.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await canvasItems(pageB)).find((it) => it.id === noteId)?.x, { timeout: 5_000 })
      .not.toBe(beforeX);

    await dblclickItem(pageA, noteId);
    await pageA.getByTestId(`item-edit-${noteId}`).fill("实时编辑");
    await pageA.keyboard.press("Enter");
    await expect
      .poll(async () => (await canvasItems(pageB)).find((it) => it.id === noteId)?.text ?? "", { timeout: 5_000 })
      .toContain("实时编辑");

    await clickItem(pageA, noteId);
    await pageA.getByTestId("wm-delete").click();
    await expectItemCount(pageA, 0);
    await expectItemCount(pageB, 0);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("只读访问者可观察最新组件状态但不能编辑", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const viewerCtx = await browser.newContext({ baseURL: BASE });
  try {
    await register(ownerCtx.request, uniq("syncOwner"));
    const room = (await (await ownerCtx.request.post("/api/rooms", {
      data: { name: "Readonly Sync", visibility: "public" },
    })).json()).room;
    const board = (await (await ownerCtx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Viewer" } })).json()).board;
    const visibility = await ownerCtx.request.patch(`/api/boards/${board.id}/visibility`, {
      data: { visibility: "public" },
    });
    expect(visibility.ok()).toBeTruthy();

    await register(viewerCtx.request, uniq("syncViewer"));
    const ownerPage = await ownerCtx.newPage();
    const viewerPage = await viewerCtx.newPage();
    await ownerPage.goto(`/boards/${board.id}`);
    await viewerPage.goto(`/boards/${board.id}`);

    await expect(viewerPage.getByTestId("board-menu")).toBeHidden();
    await ownerPage.getByTestId("add-note").click();
    await expectItemCount(viewerPage, 1);

    const write = await viewerCtx.request.post(`/api/boards/${board.id}/items`, {
      data: { type: "note", x: 10, y: 10, text: "viewer write" },
    });
    expect(write.status()).toBe(403);
  } finally {
    await ownerCtx.close();
    await viewerCtx.close();
  }
});

// p8:F02 收尾点：字段级 CRDT 合并 —— A 正在编辑某便签文本期间，B 对*另一个*便签
// 的移动仍然实时可见（不会因为 A 有一个便签处于编辑态就整体卡住同步）。这是相对
// 于"整份快照广播、编辑中概不接受远端变更"方案的关键差异；用较短的超时
// （明显短于旧的 1.5s 轮询周期）降低"其实是轮询兜底碰巧生效"的误判概率。
test("一个便签编辑中不阻塞另一个便签的实时同步", async ({ browser }) => {
  const { ctxA, ctxB, board } = await createBoardPair(browser);
  try {
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);

    await pageA.getByTestId("add-note").click();
    await expectItemCount(pageA, 1);
    const editingId = (await canvasItems(pageA))[0]!.id;
    await pageA.getByTestId("add-note").click();
    await expectItemCount(pageA, 2);
    await expectItemCount(pageB, 2);
    const movingId = (await canvasItems(pageA)).find((it) => it.id !== editingId)!.id;

    // A 进入第一个便签的编辑态，先不提交。
    await dblclickItem(pageA, editingId);
    await pageA.getByTestId(`item-edit-${editingId}`).fill("A 正在打字，还没提交");

    // B 移动第二个便签：与 A 正在编辑的不是同一条，应该不受 A 编辑态影响，很快同步给 A。
    const before = (await canvasItems(pageA)).find((it) => it.id === movingId)!.x;
    await clickItem(pageB, movingId);
    await pageB.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await canvasItems(pageA)).find((it) => it.id === movingId)?.x, { timeout: 1_200 })
      .not.toBe(before);

    // 收尾：A 提交编辑，避免影响其它用例复用同一浏览器进程时的残留状态。
    await pageA.keyboard.press("Escape");
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
