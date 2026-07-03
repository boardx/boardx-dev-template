import { test, expect, type BrowserContext, type APIRequestContext } from "@playwright/test";
import { canvasItems, expectItemCount, itemScreenRect } from "./helpers/canvas";

// p6:F13：便签可见性/拖拽坐标源迁为 canvas 兼容锚点（策略 2 / issue #269），断言意图不变。

// uc-collab-001 实时同步协作内容 —— AWARENESS + FOLLOW 层
// 建立在 uc-canvas-005（在线成员 + 内容同步）之上，补齐 UC 后置条件 1：
//   用户能理解「谁在线」「谁在操作」，以及「自己的视角是否正在跟随他人」。
//
// 用两个独立浏览器 context 模拟两名真实在线用户：
// (a) 双方互见在线；
// (b) A 操作（拖拽便签）→ B 看到 A 的「操作中」指示；
// (c) B 跟随 A → A 缩放/平移 → B 的视口贴合 A 的视口，且显示「正在跟随」横幅；
// (d) 权限分支：非成员对 presence/collab 通道 → 403。

const uniq = (p: string) => `${p}_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
const BASE = process.env.PW_BASE_URL ?? BASE_URL;

async function register(ctx: APIRequestContext, email: string) {
  const res = await ctx.post("/api/auth/register", {
    data: { firstName: "U", lastName: "U", email, password: "secret123", agreeTerms: true },
  });
  expect(res.ok()).toBeTruthy();
}

test("协作感知 + 视角跟随：谁在线 / 谁在操作 / 我是否正在跟随", async ({ browser }) => {
  const ctxA: BrowserContext = await browser.newContext({ baseURL: BASE });
  const ctxB: BrowserContext = await browser.newContext({ baseURL: BASE });
  try {
    // A 是 owner：注册 → 建房间 → 建 board。
    const emailA = uniq("collabAwareA");
    await register(ctxA.request, emailA);
    const room = (await (await ctxA.request.post("/api/rooms", { data: { name: "Aware" } })).json()).room;
    const board = (await (await ctxA.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Follow" } })).json()).board;

    // B 是第二名成员：注册 → 由 owner 邀请进房间（→ board editor 角色）。
    const emailB = uniq("collabAwareB");
    await register(ctxB.request, emailB);
    const invite = await ctxA.request.post(`/api/rooms/${room.id}/members`, { data: { email: emailB } });
    expect(invite.ok()).toBeTruthy();

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await pageA.goto(`/boards/${board.id}`);
    await pageB.goto(`/boards/${board.id}`);

    // (a) 双方互见在线（在线人数达到 2）。
    await expect(pageA.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });
    await expect(pageB.getByTestId("board-presence")).toHaveAttribute("data-online-count", "2", { timeout: 15_000 });

    // 取得 A 的 user id（B 视角下用来定位「A 的操作态 / 跟随 A」）。
    const aId = Number(
      await pageA.getByTestId("board-presence").locator('[data-testid="presence-member"][data-self="true"]').getAttribute("data-member-id"),
    );
    expect(Number.isFinite(aId)).toBeTruthy();

    // (b) A 操作（拖拽一个便签）→ B 看到 A 的「操作中」指示。
    // 先由 A 新建一个便签，等它同步到 B（uc-canvas-005 内容一致）。
    await pageA.getByTestId("add-note").click();
    await expectItemCount(pageA, 1);
    const noteAId = (await canvasItems(pageA))[0]!.id;

    // A 按住便签拖动（触发 operating=true），拖动过程中 B 应看到 A 的操作指示点亮。
    const box = await itemScreenRect(pageA, noteAId);
    await pageA.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await pageA.mouse.down();
    await pageA.mouse.move(box.x + 120, box.y + 90, { steps: 6 });

    // B 侧：A 对应成员的操作态指示出现（谁在操作）。
    await expect(pageB.getByTestId(`collab-active-${aId}`)).toBeVisible({ timeout: 15_000 });
    await expect(
      pageB.getByTestId("board-presence").locator(`[data-testid="presence-member"][data-member-id="${aId}"]`),
    ).toHaveAttribute("data-operating", "true", { timeout: 15_000 });

    // A 松手 → 操作态回落，B 侧指示消失。
    await pageA.mouse.up();
    await expect(pageB.getByTestId(`collab-active-${aId}`)).toBeHidden({ timeout: 15_000 });

    // (c) B 跟随 A → A 缩放/平移 → B 的视口贴合 A 的视口，且显示「正在跟随」横幅。
    await pageB.getByTestId(`follow-${aId}`).click();
    await expect(pageB.getByTestId("following-banner")).toBeVisible();
    await expect(pageB.getByTestId("canvas-surface")).toHaveAttribute("data-following", "true");

    // A 改变视口：连点放大（scale 变化，确定性），并拖拽平移一段（tx/ty 变化）。
    await pageA.getByTestId("zoom-in").click();
    await pageA.getByTestId("zoom-in").click();
    const vpA = pageA.getByTestId("canvas-viewport");
    const vpBox = await vpA.boundingBox();
    await pageA.mouse.move(vpBox!.x + 400, vpBox!.y + 300);
    await pageA.mouse.down();
    await pageA.mouse.move(vpBox!.x + 460, vpBox!.y + 360, { steps: 4 });
    await pageA.mouse.up();

    // 读出 A 的视口快照。
    const aScale = await pageA.getByTestId("canvas-surface").getAttribute("data-vp-scale");
    const aTx = await pageA.getByTestId("canvas-surface").getAttribute("data-vp-tx");
    const aTy = await pageA.getByTestId("canvas-surface").getAttribute("data-vp-ty");
    expect(aScale).not.toBe("1"); // A 确实缩放了

    // B 的视口应跟随贴合 A（经 presence 心跳传播 + 跟随推送）。
    await expect(pageB.getByTestId("canvas-surface")).toHaveAttribute("data-vp-scale", aScale!, { timeout: 15_000 });
    await expect(pageB.getByTestId("canvas-surface")).toHaveAttribute("data-vp-tx", aTx!, { timeout: 15_000 });
    await expect(pageB.getByTestId("canvas-surface")).toHaveAttribute("data-vp-ty", aTy!, { timeout: 15_000 });

    // 停止跟随：横幅消失，B 视口不再标记为跟随。
    await pageB.getByTestId("stop-following").click();
    await expect(pageB.getByTestId("following-banner")).toBeHidden();
    await expect(pageB.getByTestId("canvas-surface")).toHaveAttribute("data-following", "false");
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("(d) 非成员对 presence/collab 通道 → 403", async ({ browser }) => {
  const ownerCtx = await browser.newContext({ baseURL: BASE });
  const outsiderCtx = await browser.newContext({ baseURL: BASE });
  try {
    // owner 建私有房间 + board。
    await register(ownerCtx.request, uniq("collabOwner"));
    const room = (await (await ownerCtx.request.post("/api/rooms", { data: { name: "Priv", visibility: "private" } })).json()).room;
    const board = (await (await ownerCtx.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Locked" } })).json()).board;

    // 局外人（已登录，非成员）。
    await register(outsiderCtx.request, uniq("collabOutsider"));

    // presence/collab 心跳通道（携带协作感知 payload）：局外人 → 403（跟随通道同样门控）。
    const presence = await outsiderCtx.request.post(`/api/boards/${board.id}/presence`, {
      data: { operating: true, viewport: { x: 10, y: 20, scale: 2 } },
    });
    expect(presence.status()).toBe(403);

    // GET presence 也门控。
    const read = await outsiderCtx.request.get(`/api/boards/${board.id}/presence`);
    expect(read.status()).toBe(403);
  } finally {
    await ownerCtx.close();
    await outsiderCtx.close();
  }
});
