import { defineConfig, devices } from "@playwright/test";

// e2e 配置：webServer 用 next dev（免 build，DATABASE_URL 从环境继承）。
// 已有端口在跑则复用（reuseExistingServer）。默认 3000，可用 E2E_PORT 临时覆盖
// （多 worktree 并行开发时端口冲突的本地临时手段，不改变默认行为）。
const PORT = process.env.E2E_PORT ?? "3000";
// CAP-PAYMENT（F05）：webhook 走共享密钥 fail-closed 校验（见 lib/webhook-auth.ts）。
// e2e 里模拟支付网关回调需要带上这把密钥；没有真实网关时用一个仅测试用的默认值，
// 生产环境必须通过环境变量覆盖成真实值（.env.example 里也标了同名变量）。
export const E2E_WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "e2e-test-only-webhook-secret";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  // CI 上对 timing 敏感的用例（canvas 交互 / profile 保存）偶发 flake → 自动重试 2 次。
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ...process.env, WEBHOOK_SECRET: E2E_WEBHOOK_SECRET },
  },
});
