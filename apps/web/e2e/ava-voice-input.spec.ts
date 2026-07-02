import { expect, test, type Page } from "@playwright/test";

const uniq = () => `ava_voice_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;
type VoiceMockMode =
  | "success"
  | "permission-denied"
  | "no-device"
  | "unsupported"
  | "too-short"
  | "transcribe-failed";

async function register(page: Page) {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "Voice", email: uniq(), password: "secret123", agreeTerms: true },
  });
}

async function openAvaWithVoiceMock(
  page: Page,
  mock: { mode: VoiceMockMode; transcript?: string }
) {
  await register(page);
  await page.goto("/ava");
  await page.evaluate((voiceMock) => {
    window.__avaVoiceMock = voiceMock;
  }, mock);
  await expect(page.getByTestId("voice-button")).toBeVisible();
}

async function clickTestId(page: Page, testId: string) {
  await page.getByTestId(testId).dispatchEvent("click");
}

test("语音输入成功转写后填入 composer，用户可检查后发送", async ({ page }) => {
  await openAvaWithVoiceMock(page, {
    mode: "success",
    transcript: "请把这段语音整理成行动项",
  });

  await clickTestId(page, "voice-button");
  await expect(page.getByTestId("voice-recorder")).toBeVisible();
  await expect(page.getByTestId("voice-time-left")).toContainText("剩余");
  await expect(page.getByTestId("voice-meter")).toBeVisible();
  await clickTestId(page, "voice-stop");

  await expect(page.getByTestId("voice-transcript-preview")).toContainText("请把这段语音整理成行动项");
  await expect(page.getByTestId("composer")).toHaveValue("请把这段语音整理成行动项");

  await page.getByTestId("composer").fill("请把这段语音整理成行动项，并按优先级排序");
  await expect(page.getByTestId("composer")).toHaveValue("请把这段语音整理成行动项，并按优先级排序");
  await expect(page.getByTestId("send")).toBeEnabled();
});

test("取消录音不会发送空消息", async ({ page }) => {
  await openAvaWithVoiceMock(page, {
    mode: "success",
    transcript: "这段内容不应该出现",
  });

  await clickTestId(page, "voice-button");
  await expect(page.getByTestId("voice-recorder")).toBeVisible();
  await clickTestId(page, "voice-cancel");

  await expect(page.getByTestId("voice-recorder")).toBeHidden();
  await expect(page.getByTestId("composer")).toHaveValue("");
  await expect(page.getByTestId("send")).toBeDisabled();
  await expect(page.getByTestId("empty")).toBeVisible();
  await expect(page.getByTestId("msg-user")).toHaveCount(0);
});

test("录音过短时不填入 composer 并展示提示", async ({ page }) => {
  await openAvaWithVoiceMock(page, { mode: "too-short" });

  await clickTestId(page, "voice-button");
  await expect(page.getByTestId("voice-recorder")).toBeVisible();
  await clickTestId(page, "voice-stop");

  await expect(page.getByTestId("voice-error")).toContainText("录音时间太短");
  await expect(page.getByTestId("composer")).toHaveValue("");
});

test("转写失败时不填入 composer 并展示提示", async ({ page }) => {
  await openAvaWithVoiceMock(page, { mode: "transcribe-failed" });

  await clickTestId(page, "voice-button");
  await expect(page.getByTestId("voice-recorder")).toBeVisible();
  await clickTestId(page, "voice-stop");

  await expect(page.getByTestId("voice-error")).toContainText("语音转写失败");
  await expect(page.getByTestId("composer")).toHaveValue("");
});

test("麦克风权限被拒时展示对应提示", async ({ page }) => {
  await openAvaWithVoiceMock(page, { mode: "permission-denied" });

  await clickTestId(page, "voice-button");

  await expect(page.getByTestId("voice-error")).toContainText("麦克风权限被拒绝");
  await expect(page.getByTestId("voice-recorder")).toHaveCount(0);
});

test("浏览器不支持语音输入时展示对应提示", async ({ page }) => {
  await openAvaWithVoiceMock(page, { mode: "unsupported" });

  await clickTestId(page, "voice-button");

  await expect(page.getByTestId("voice-error")).toContainText("当前浏览器不支持语音输入");
  await expect(page.getByTestId("voice-recorder")).toHaveCount(0);
});

test("无可用麦克风时展示对应提示", async ({ page }) => {
  await openAvaWithVoiceMock(page, { mode: "no-device" });

  await clickTestId(page, "voice-button");

  await expect(page.getByTestId("voice-error")).toContainText("没有检测到可用麦克风");
  await expect(page.getByTestId("voice-recorder")).toHaveCount(0);
});
