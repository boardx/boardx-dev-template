import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  const values = new Map<string, string>();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    values.set(key, value);
  }
  for (const [key, value] of values) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function loadWorktreeEnv() {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      loadEnvFile(join(dir, ".env"));
      loadEnvFile(join(dir, "apps/web/.env.local"));
      return;
    }
    dir = dirname(dir);
  }
  loadEnvFile(join(process.cwd(), ".env.local"));
}

loadWorktreeEnv();

// e2e 配置：webServer 用 next dev（免 build，DATABASE_URL 从环境继承）。
// 已有该端口在跑则复用（reuseExistingServer）。
// 端口可用 E2E_PORT 覆盖（默认 3000）——多个 worktree 并行跑 e2e 时，"复用已有 server"
// 会复用到别的 worktree/分支的 server，测出来的是别人的代码；scripts/init-worktree-env.sh
// 会给每个 worktree 分配独立的 E2E_PORT 写进 apps/web/.env.local 来避免这个问题。
// loadWorktreeEnv() 已把 .env / apps/web/.env.local 里的值灌进 process.env，这里直接读。
const PORT = process.env.E2E_PORT || "3000";
const COLLAB_WS_PORT = process.env.COLLAB_WS_PORT || "3001";
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
  webServer: [
    {
      command: `next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ...process.env, WEBHOOK_SECRET: E2E_WEBHOOK_SECRET },
    },
    {
      command: "node server/collab-gateway.mjs",
      url: `http://localhost:${COLLAB_WS_PORT}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
      env: { ...process.env, COLLAB_WS_PORT },
    },
  ],
});
