// devportal e2e（p30-F02 起，最小配置；p30-F03 追加目录 fixture server）。
// 本地：自动起 next dev（原型页全 mock，无外部依赖）；SESSION_SECRET 用测试值，
// e2e 里据此签测试 session cookie（mock 会话注入，见 e2e/p30/auth-gray.spec.ts）。
// p30-F03（workspace-authz.spec.ts）额外需要平台目录读面：本地起一个固定数据的
// fixture server（e2e/fixtures/directory-fixture-server.mjs）模拟 coord-gateway 的
// /api/coord/directory/*，next dev 的 COORD_GATEWAY_URL/COORD_API_TOKEN 指向它——
// lib/workspace-authz.ts 本身对测试环境零特判，走的是与生产同一条 fetch 路径。
// 远端：DEVPORTAL_E2E_BASE_URL=https://develop.boardx.us 时不起本地服务
// （届时 mock 会话 / fixture 目录用例自动跳过——远端 secret 不可知，属诚实降级）。
import { defineConfig } from "@playwright/test";
import { FIXTURE_PORT, FIXTURE_TOKEN } from "./e2e/fixtures/directory-fixture-constants.mjs";

const remoteBase = process.env["DEVPORTAL_E2E_BASE_URL"];

export const E2E_SESSION_SECRET = "devportal-e2e-session-secret-32bytes!";
export const E2E_DIRECTORY_TOKEN = FIXTURE_TOKEN;

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
        webServer: [
          {
            command: `node e2e/fixtures/directory-fixture-server.mjs ${FIXTURE_PORT}`,
            url: `http://127.0.0.1:${FIXTURE_PORT}/healthz`,
            reuseExistingServer: true,
            timeout: 30_000,
          },
          {
            command: "pnpm dev",
            url: "http://127.0.0.1:3400/explore",
            reuseExistingServer: true,
            timeout: 120_000,
            env: {
              SESSION_SECRET: E2E_SESSION_SECRET,
              COORD_GATEWAY_URL: `http://127.0.0.1:${FIXTURE_PORT}`,
              COORD_API_TOKEN: FIXTURE_TOKEN,
            },
          },
        ],
      }),
});
