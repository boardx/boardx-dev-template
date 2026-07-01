import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readLocalEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return undefined;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0 || trimmed.slice(0, idx) !== key) continue;
    return trimmed.slice(idx + 1).trim();
  }
  return undefined;
}

// e2e 配置：webServer 用 next dev（免 build，DATABASE_URL 从环境继承）。
// 已有该端口在跑则复用（reuseExistingServer）。
// 端口可用 E2E_PORT 覆盖（默认 3000）——多个 worktree 并行跑 e2e 时，"复用已有 server"
// 会复用到别的 worktree/分支的 server，测出来的是别人的代码；scripts/init-worktree-env.sh
// 会给每个 worktree 分配独立的 E2E_PORT 写进 apps/web/.env.local 来避免这个问题。
const PORT = readLocalEnv("E2E_PORT") || "3000";

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
