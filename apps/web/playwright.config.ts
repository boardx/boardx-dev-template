import { defineConfig, devices } from "@playwright/test";

// e2e 配置：webServer 用 next dev（免 build，DATABASE_URL 从环境继承）。
// 已有端口在跑则复用（reuseExistingServer）。默认 3000，可用 E2E_PORT 临时覆盖
// （多 worktree 并行开发时端口冲突的本地临时手段，不改变默认行为）。
const PORT = process.env.E2E_PORT ?? "3000";
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
  },
});
