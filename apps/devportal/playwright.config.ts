// devportal e2e（p30-F02 起，最小配置）。
// 本地：自动起 next dev（原型页全 mock，无外部依赖）；SESSION_SECRET 用测试值，
// e2e 里据此签测试 session cookie（mock 会话注入，见 e2e/p30/auth-gray.spec.ts）。
// 远端：DEVPORTAL_E2E_BASE_URL=https://develop.boardx.us 时不起本地服务
// （届时 mock 会话用例自动跳过——远端 secret 不可知，属诚实降级）。
import { defineConfig } from "@playwright/test";

const remoteBase = process.env["DEVPORTAL_E2E_BASE_URL"];

export const E2E_SESSION_SECRET = "devportal-e2e-session-secret-32bytes!";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: remoteBase ?? "http://127.0.0.1:3400",
  },
  ...(remoteBase
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          url: "http://127.0.0.1:3400/explore",
          reuseExistingServer: true,
          timeout: 120_000,
          env: { SESSION_SECRET: E2E_SESSION_SECRET },
        },
      }),
});
