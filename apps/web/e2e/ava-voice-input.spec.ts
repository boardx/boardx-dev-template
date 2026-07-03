import { test, expect } from "@playwright/test";

// p18 F07：语音输入端到端接通（真实转写替换占位文案）。
//
// Playwright chromium project 已在 playwright.config.ts 里加了
// --use-fake-device-for-media-stream / --use-fake-ui-for-media-stream，
// 提供一个可用的假麦克风设备并自动通过权限弹窗，getUserMedia 在无真实硬件的 CI
// 环境里也能真实走通（注意：不要额外调用 context.grantPermissions(["microphone"])——
// 它会触发 Playwright 自己的 CDP 权限覆盖逻辑，和 fake-ui 标志的自动授权互相干扰，
// 实测会导致 getUserMedia 的 promise 挂起不 resolve）。
//
// 后端 /api/ava/transcribe：本地/CI 没有配置 OPENAI_API_KEY 时，走该端点内置的
// 确定性 stub 回退（不绕过真实代码路径——鉴权/上传/调用/回填逻辑全部真实执行，
// 只是不发起真实 Whisper API 请求），返回 `[stub 转写] ...` 文案。真实 STT 由 F06 的
// node scripts/stt-smoke.mjs 冒烟覆盖（env-gated）。

const uniq = () => `ava_voice_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function register(page: import("@playwright/test").Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "V", email: uniq(), password: "secret123", agreeTerms: true },
  });
}


test("录音结束后：真实转写文本回填输入框（替换固定占位文案）", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();

  // 保证超过最短录音时长保护（MIN_RECORDING_MS = 1000ms）。
  await page.waitForTimeout(1500);

  await page.getByTestId("voice-stop").click();

  // 转写中过渡态可见，随后输入框被真实转写文本填入。
  const composer = page.getByTestId("composer");
  await expect(composer).not.toHaveValue("", { timeout: 10_000 });
  const value = await composer.inputValue();
  expect(value.length).toBeGreaterThan(0);
  // 不再是 UI 原型时代的固定占位文案。
  expect(value).not.toContain("帮我总结一下这份材料的关键结论");
  expect(value).not.toContain("请把这段内容改写得更简洁一些");
  expect(value).not.toContain("根据以上讨论，列出三个下一步行动项");

  // 回到 idle 态：录音指示条消失，麦克风按钮恢复可点。
  await expect(page.getByTestId("voice-recording-indicator")).toHaveCount(0);
  await expect(page.getByTestId("voice-input-trigger")).toBeEnabled();
});

test("取消录音：不产生任何文本，输入框保持录音前状态", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  const composer = page.getByTestId("composer");
  await composer.fill("取消前的草稿");

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(500);

  await page.getByTestId("voice-cancel").click();

  await expect(page.getByTestId("voice-recording-indicator")).toHaveCount(0);
  // 取消不追加/替换任何转写文本，输入框内容不变。
  await expect(composer).toHaveValue("取消前的草稿");
  await expect(page.getByTestId("voice-transcribing")).toHaveCount(0);
  await expect(page.getByTestId("voice-error")).toHaveCount(0);
});

test("转写请求失败时展示 transcription-failed 错误文案", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.route("**/api/ava/transcribe", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "stt down" }) })
  );

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("voice-stop").click();

  await expect(page.getByTestId("voice-error")).toContainText("转写失败");
  await expect(page.getByTestId("composer")).toHaveValue("");
});
