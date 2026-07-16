import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// P18 F02（e2e/ava-real-model-failure.spec.ts）需要把 anthropicProvider 的请求路由到本地假
// server：ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY 必须在 next dev 启动前就生效（见 anthropicProvider.ts
// 顶部注释——baseUrl 在模块加载时读一次 env，测试运行时再改环境变量不起作用）。
// 但这两个 key 有可能已经被外部环境（比如本机/开发容器上为其它工具配置的 Anthropic 凭证）
// 提前设置为真实端点/真实 key；如果沿用下面「已存在则不覆盖」的通用语义，worktree 本地的
// .env.local 配置会被那个外部值悄悄吃掉，e2e 就会真的打到 api.anthropic.com。
// 这两个 key 是 apps/web/.env.local 明确要接管的测试专用配置，所以强制覆盖，不参与
// "已存在则跳过" 的通用规则；其它 key（DATABASE_URL 等）维持原语义不变。
const FORCE_OVERRIDE_KEYS = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_TIMEOUT_MS",
]);

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
    if (process.env[key] === undefined || FORCE_OVERRIDE_KEYS.has(key)) {
      process.env[key] = value;
    }
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

// e2e 配置：webServer 本地用 next dev（免 build，快速回环），**CI 上用生产构建**
// （next build && next start，见下方 WEB_COMMAND）。
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

// CI 上跑生产构建而不是 next dev（#665）。
//
// next dev 按需编译，并会为动态路由起 `static-paths-worker` 子进程去探静态路径；
// 那个 worker 与主进程的 chunk 视图不一致，会 require 到尚未 emit 的
// `.next/server/vendor-chunks/*.js`。实测 e2e-full：前 60 个用例全绿，第 8 分钟
// 起 `Cannot find module './vendor-chunks/pg@8.12.0.js'`（单次运行 1541 次），
// 此后每个碰 DB 的路由 500 返回 HTML 错误页 → 测试拿到 `<!DOCTYPE` 而非 JSON，
// 584/731 用例雪崩、耗时 5.7h（绝大部分是对着死掉的 server 等超时），连红 12 次
// 无人察觉。另一次运行同样模式挂在 `micromark-core-commonmark`——与具体包无关，
// 是 dev 这条路径本身的问题。
//
// 生产构建从结构上消除该故障：`next build` 一次编译完所有路由，**根本不产生
// vendor-chunks/ 目录**（那是 dev 专有产物），也不走 dev 的 static-paths-worker；
// 顺带省掉按需编译的巨额耗时。本地仍用 next dev 保留快速回环。
const IS_CI = !!process.env.CI;
const WEB_COMMAND = IS_CI ? `next build && next start -p ${PORT}` : `next dev -p ${PORT}`;
// 生产构建要先编译再起服务，120s 不够（实测构建本身约 1-3 分钟）。
const WEB_TIMEOUT = IS_CI ? 600_000 : 120_000;
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
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // p18 F07（语音输入 e2e）需要真实 getUserMedia/MediaRecorder 链路可用，
        // 但 CI/无摄像头环境没有真实麦克风——用 Chromium 的 fake device 标志：
        // 授权自动通过（fake-ui）+ 提供一个可用的假音频输入设备（fake-device）。
        // 只影响 chromium 这一个 project，不改变其余测试的启动参数。
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
  webServer: [
    {
      command: WEB_COMMAND,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: true,
      timeout: WEB_TIMEOUT,
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
