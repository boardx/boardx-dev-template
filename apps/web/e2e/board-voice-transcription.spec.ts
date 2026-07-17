import { test, expect } from "@playwright/test";
import { canvasItems, expectItemCount, waitForCanvasReady } from "./helpers/canvas";

// p7:F10（uc-board-header-006）：语音转录到白板。Header 麦克风录制 + 转写（复用 AVA 同款
// VoiceInputControl，STT 见 p18:F06/F07）完成后，识别文本作为文本组件写入画布并自动选中。
//
// Playwright chromium project 已在 playwright.config.ts 加了
// --use-fake-device-for-media-stream / --use-fake-ui-for-media-stream，
// getUserMedia 在无真实硬件的环境里也能真实走通（同 ava-voice-input.spec.ts 的先例，
// 不要额外调用 context.grantPermissions(["microphone"])，会和 fake-ui 互相干扰）。
// 无 OPENAI_API_KEY 的本地/CI 环境走 /api/ava/transcribe 内置的确定性 stub 回退——
// 鉴权/上传/调用/回填逻辑全部真实执行，只是不发真实 Whisper 请求。

const uniq = () => `bvoice_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function createBoard(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "T", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await page.request.post("/api/rooms", { data: { name: "Voice Room" } })).json()).room;
  const board = (
    await (await page.request.post(`/api/rooms/${room.id}/boards`, { data: { name: "Voice Board" } })).json()
  ).board;
  return { room, board };
}

test("录音结束后：转写文本作为文本组件写入画布并自动选中", async ({ page }) => {
  const { board } = await createBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);
  await expectItemCount(page, 0);

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500); // 超过 MIN_RECORDING_MS=1000ms 的最短录音保护
  await page.getByTestId("voice-stop").click();

  await expect(page.getByTestId("voice-transcribing")).toBeVisible().catch(() => {}); // 过渡态可能一闪而过
  await expectItemCount(page, 1);

  const item = (await canvasItems(page))[0]!;
  expect(item.kind).toBe("text");
  expect(item.text.length).toBeGreaterThan(0);

  // 自动选中新写入的文本组件（UC 主流程 6）。
  const selected = await page.evaluate(() => window.__canvasTestApi!.getSelectedIds());
  expect(selected).toEqual([item.id]);

  await expect(page.getByTestId("voice-recording-indicator")).toHaveCount(0);
  await expect(page.getByTestId("voice-input-trigger")).toBeEnabled();
});

test("取消录音：不产生任何白板内容", async ({ page }) => {
  const { board } = await createBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(500);
  await page.getByTestId("voice-cancel").click();

  await expect(page.getByTestId("voice-recording-indicator")).toHaveCount(0);
  await expectItemCount(page, 0);
});

test("转写请求失败：展示错误提示，不写入任何白板内容", async ({ page }) => {
  const { board } = await createBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.route("**/api/ava/transcribe", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "stt down" }) }),
  );

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("voice-stop").click();

  await expect(page.getByTestId("voice-error")).toContainText("转写失败");
  await expectItemCount(page, 0);
});

test("转写结果为空白（识别失败/静音）：不创建组件，也不留下空文本垃圾", async ({ page }) => {
  const { board } = await createBoard(page);
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await page.route("**/api/ava/transcribe", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "   " }) }),
  );

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("voice-stop").click();

  await expect(page.getByTestId("voice-input-trigger")).toBeEnabled();
  await expectItemCount(page, 0);
});

test("viewer（无编辑权限）看不到语音录制入口", async ({ page, playwright }) => {
  const BASE_URL = process.env.E2E_PORT ? `http://localhost:${process.env.E2E_PORT}` : "http://localhost:3000";
  const owner = await playwright.request.newContext({ baseURL: BASE_URL });
  await owner.post("/api/auth/register", {
    data: { firstName: "O", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
  const room = (await (await owner.post("/api/rooms", { data: { name: "Public Voice Room" } })).json()).room;
  const board = (
    await (await owner.post(`/api/rooms/${room.id}/boards`, { data: { name: "Public Voice Board" } })).json()
  ).board;
  await owner.patch(`/api/boards/${board.id}/visibility`, { data: { visibility: "public" } });

  await page.request.post("/api/auth/register", {
    data: { firstName: "V", lastName: "W", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto(`/boards/${board.id}`);
  await waitForCanvasReady(page);

  await expect(page.getByTestId("board-header")).toBeVisible();
  await expect(page.getByTestId("voice-input-trigger")).toHaveCount(0);

  await owner.dispose();
});
