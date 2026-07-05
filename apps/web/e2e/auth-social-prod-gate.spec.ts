import { test, expect, request as playwrightRequest } from "@playwright/test";
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

// p21 F01（issue #373）—— 社交登录后门修正：生产环境 gate 回归测试。
//
// 背景：apps/web/app/api/auth/social/route.ts 是一个 demo 登录桩（uc-auth-003 stub，
// 不接真 OAuth），此前没有任何生产环境保护——只要 provider 在白名单内，任何人 POST 一下
// 就能免密创建/登录一个真实账号，等于一个公开的认证后门。修复后该路由在
// process.env.NODE_ENV === "production" 时整体拒绝请求（404）。
//
// 这里为什么不能复用 playwright.config.ts 里共享的 webServer：那个 server 用
// `next dev` 启动，Next.js 在 dev 模式下会强制 NODE_ENV=development，同一个进程内无法
// 在运行期把它切换成 production 来验证生产分支。所以本文件在 beforeAll 里单独构建
// 一个 production 模式的 next start 实例（独立端口，不影响共享 dev server / 其它用例），
// 只用来验证这一个安全 gate，跑完立即关闭。

let child: ChildProcess | undefined;
let baseURL: string;

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("failed to allocate port")));
      }
    });
  });
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const ctx = await playwrightRequest.newContext();
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      try {
        const res = await ctx.get(`${url}/api/health`, { timeout: 2000 });
        if (res.ok()) return;
      } catch {
        // server not up yet, keep polling
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`production server did not become healthy within ${timeoutMs}ms`);
  } finally {
    await ctx.dispose();
  }
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const port = await findFreePort();
  baseURL = `http://127.0.0.1:${port}`;

  // 生产模式需要先有生产构建产物；已存在 .next 生产构建则 next start 直接复用，
  // 否则这里现建一份（同一份构建产物给本文件所有用例共用）。
  const { execSync } = await import("node:child_process");
  execSync("pnpm exec next build", {
    cwd: __dirname + "/..",
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });

  child = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: __dirname + "/..",
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "pipe",
  });

  await waitForHealth(baseURL, 60_000);
});

test.afterAll(async () => {
  if (child) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      child?.once("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
});

test("生产环境下 POST /api/auth/social 被拒绝（404），不建立会话", async () => {
  const ctx = await playwrightRequest.newContext({ baseURL });
  try {
    const res = await ctx.post("/api/auth/social", { data: { provider: "google" } });
    expect(res.status()).toBe(404);
    // 生产环境下不应该设置任何会话 cookie。
    const cookies = await ctx.storageState();
    const sessionCookie = cookies.cookies.find((c) => c.name.toLowerCase().includes("session"));
    expect(sessionCookie).toBeUndefined();
  } finally {
    await ctx.dispose();
  }
});

test("生产环境下即便 provider 未知/为空，也是同样的 404 拒绝（gate 在校验之前生效）", async () => {
  const ctx = await playwrightRequest.newContext({ baseURL });
  try {
    const res = await ctx.post("/api/auth/social", { data: { provider: "myspace" } });
    expect(res.status()).toBe(404);
  } finally {
    await ctx.dispose();
  }
});
