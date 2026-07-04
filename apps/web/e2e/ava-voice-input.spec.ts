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
// 只是不发起真实 Whisper API 请求），返回 `[占位转写・未配置转写服务] ...` 文案。
// 真实 STT 由 F06 的 node scripts/stt-smoke.mjs 冒烟覆盖（env-gated）。
//
// 本文件同时覆盖 review 返工必修项：体积上限（413）/ MIME 白名单（415）——前端断言
// 走 route mock（验证前端错误分支复用 transcription-failed，不新增状态），后端断言
// 直接打真实端点（验证服务端校验本身生效，不依赖前端 mock）。

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

// 服务端体积上限（413）：mock 转写端点返回结构化 413，前端应落到既有的
// transcription-failed 错误分支（不新增错误状态），不把服务端错误文案透传成别的展示。
test("音频超过体积上限时（413）展示 transcription-failed 错误文案", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.route("**/api/ava/transcribe", (route) =>
    route.fulfill({
      status: 413,
      contentType: "application/json",
      body: JSON.stringify({ error: "音频文件过大（上限 25MB）" }),
    })
  );

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("voice-stop").click();

  await expect(page.getByTestId("voice-error")).toContainText("转写失败");
  await expect(page.getByTestId("composer")).toHaveValue("");
});

// MIME 类型不在白名单（415）：同样落到 transcription-failed 分支。
test("音频 MIME 类型不受支持时（415）展示 transcription-failed 错误文案", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.route("**/api/ava/transcribe", (route) =>
    route.fulfill({
      status: 415,
      contentType: "application/json",
      body: JSON.stringify({ error: "不支持的音频类型：audio/x-bogus" }),
    })
  );

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("voice-stop").click();

  await expect(page.getByTestId("voice-error")).toContainText("转写失败");
  await expect(page.getByTestId("composer")).toHaveValue("");
});

// 直接打真实的 /api/ava/transcribe 端点（不 mock），验证服务端体积/MIME 校验本身
// 确实生效并返回结构化的 413/415（覆盖必修项 1 的后端行为，不止是前端错误分支）。
test("POST /api/ava/transcribe：超过 25MB 返回结构化 413", async ({ page }) => {
  await register(page);
  const oversized = Buffer.alloc(25 * 1024 * 1024 + 1, 1);
  const res = await page.request.post("/api/ava/transcribe", {
    multipart: {
      file: {
        name: "big.webm",
        mimeType: "audio/webm",
        buffer: oversized,
      },
    },
  });
  expect(res.status()).toBe(413);
  const body = (await res.json()) as { error?: string };
  expect(typeof body.error).toBe("string");
  expect(body.error?.length).toBeGreaterThan(0);
});

test("POST /api/ava/transcribe：MIME 类型不在白名单返回结构化 415", async ({ page }) => {
  await register(page);
  const res = await page.request.post("/api/ava/transcribe", {
    multipart: {
      file: {
        name: "clip.exe",
        mimeType: "application/x-msdownload",
        buffer: Buffer.from("not audio"),
      },
    },
  });
  expect(res.status()).toBe(415);
  const body = (await res.json()) as { error?: string };
  expect(typeof body.error).toBe("string");
  expect(body.error?.length).toBeGreaterThan(0);
});

// 无 OPENAI_API_KEY 时（本地/CI 默认场景）：占位转写文本应带用户可见提示，不悄悄
// 冒充真实转写（建议项 3）。
test("无转写服务凭证时：转写结果附带占位提示（不伪装成真实转写）", async ({ page }) => {
  await register(page);
  await page.goto("/ava");

  await page.getByTestId("voice-input-trigger").click();
  await expect(page.getByTestId("voice-recording-indicator")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId("voice-stop").click();

  const composer = page.getByTestId("composer");
  await expect(composer).not.toHaveValue("", { timeout: 10_000 });
  // 本地/CI 默认没有 OPENAI_API_KEY，走 stub 回退，提示应可见。
  await expect(page.getByTestId("voice-stub-notice")).toBeVisible();
});
