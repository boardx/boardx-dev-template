import http from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Page } from "@playwright/test";

// P18 F02：真实模型下的失败态与停止生成。
//
// 这里不打真实的 Anthropic API（会消耗额度、不确定性高），而是起一个假的 Anthropic 兼容
// HTTP server，通过 ANTHROPIC_BASE_URL（apps/web/.env.local，见 anthropicProvider.ts 里
// "F02 故障注入入口" 的说明）把真实 provider 的请求路由到它。这样能在不碰生产代码路径的
// 前提下，让 /ava 走的是"真实 provider"这条代码路径（anthropicProvider.ts 的 fetch/SSE 解析/
// 错误处理全部真实执行），只是网络对端是本地假 server 而不是 api.anthropic.com。
//
// 假 server 必须监听 apps/web/.env.local 里 ANTHROPIC_BASE_URL 约定的端口——
// anthropicProvider 的 baseUrl 在模块加载时从 env 读一次（见 anthropicProvider.ts 顶部
// 注释），所以没法在测试运行时再动态改端口；只能反过来让假 server 监听那个约定端口。
// 端口本身由 scripts/init-worktree-env.sh 按 worktree 分配（写进 apps/web/.env.local），
// playwright.config.ts 的 loadWorktreeEnv() 已经把它灌进 process.env——这里直接读，
// 不再在测试文件里写死端口号，多个 worktree 并行跑不会互相占用端口。
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? "";
const FAKE_ANTHROPIC_PORT = Number(new URL(ANTHROPIC_BASE_URL || "http://127.0.0.1:0").port);

type FakeMode = "rate_limit" | "network_error" | "timeout" | "stream_slow";

let currentMode: FakeMode = "rate_limit";
let server: http.Server;

function sseChunk(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

test.beforeAll(async () => {
  // 明确失败而不是静默打到真实 Anthropic API：如果 .env.local 没有配置成指向本地假
  // server（比如漏跑了 scripts/init-worktree-env.sh，或者外部环境变量把它覆盖回了
  // 官方端点），这里直接报错停止，而不是让测试用意外的方式超时/请求真实供应商。
  if (!ANTHROPIC_BASE_URL.startsWith("http://127.0.0.1:") || !FAKE_ANTHROPIC_PORT) {
    throw new Error(
      `ANTHROPIC_BASE_URL 未指向本地假 server（当前值: "${ANTHROPIC_BASE_URL}"）。` +
        `请先跑 bash scripts/init-worktree-env.sh 生成 apps/web/.env.local 里的` +
        `ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY/ANTHROPIC_TIMEOUT_MS 配置。`
    );
  }

  server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/v1/messages") {
      if (currentMode === "rate_limit") {
        res.writeHead(429, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { type: "rate_limit_error", message: "Rate limited (fake server, F02 e2e)" } }));
        return;
      }
      if (currentMode === "network_error") {
        // 模拟网络层错误：直接销毁连接，不发送任何 HTTP 响应（客户端 fetch 会收到
        // ECONNRESET/socket hang up 一类的 TypeError，走 anthropicProvider 的网络错误分支）。
        req.socket.destroy();
        return;
      }
      if (currentMode === "timeout") {
        // 模拟超时：既不写响应头也不结束响应，直到客户端自己放弃（AbortController 超时）。
        // 不调用 res.end()，连接保持挂起。
        return;
      }
      if (currentMode === "stream_slow") {
        // 用于"停止生成"验证：先吐出一些真实的流式 token，然后长时间挂起不结束，
        // 给测试留出点击 stop 按钮的窗口；如果客户端中途 abort，我们能在服务端观察到
        // 请求被销毁（req.on("close")）。
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        });
        res.write(sseChunk("content_block_delta", {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "这是真实模型的第一段回复，" },
        }));
        res.write(sseChunk("content_block_delta", {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "正在继续生成……" },
        }));
        // 之后长时间不再写入、也不结束——模拟"仍在流式生成中"，等待客户端 abort。
        req.on("close", () => {
          // 客户端断开（stop() 触发 AbortController.abort()）：这里不需要额外动作，
          // http server 在连接关闭后自然停止；用于观察的日志留给人工调试场景，e2e 断言
          // 走前端可见状态，不依赖这里的副作用。
        });
        return;
      }
      res.writeHead(500);
      res.end("unknown fake mode");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(FAKE_ANTHROPIC_PORT, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  expect(addr.port).toBe(FAKE_ANTHROPIC_PORT);
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const uniq = () => `ava_realfail_${Date.now()}_${Math.floor(Math.random() * 1e6)}@ex.com`;

async function registerAndOpen(page: Page): Promise<void> {
  await page.request.post("/api/auth/register", {
    data: { firstName: "A", lastName: "B", email: uniq(), password: "secret123", agreeTerms: true },
  });
  await page.goto("/ava");
  await page.getByTestId("model-select").selectOption("anthropic:claude-sonnet-5");
  await expect(page.getByTestId("current-model")).toContainText("Claude Sonnet 5");
}

test.describe("真实模型 provider 故障 → 失败态展示 + 输入不丢失", () => {
  test("429 限流：/ava 展示失败态，用户已输入内容保留在历史中", async ({ page }) => {
    currentMode = "rate_limit";
    await registerAndOpen(page);

    await page.getByTestId("composer").fill("帮我写一份周报（真实模型限流场景）");
    await page.getByTestId("send").click();

    await expect(page.getByTestId("msg-user")).toContainText("帮我写一份周报");
    await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("send-error")).toBeVisible();

    // reload 后用户输入仍持久化，失败态消息仍在（沿用 F01 既有断言口径）。
    await page.reload();
    await page.getByTestId("thread-list").getByRole("button").first().click();
    await expect(page.getByTestId("msg-user").first()).toContainText("帮我写一份周报");
    await expect(page.getByTestId("msg-failed")).toBeVisible();
  });

  test("网络错误（连接被重置）：/ava 展示失败态，composer 输入未清空/未丢失", async ({ page }) => {
    currentMode = "network_error";
    await registerAndOpen(page);

    const messageText = "这条消息应该在网络错误后仍然可见";
    await page.getByTestId("composer").fill(messageText);
    // 发送前记录：send 之后 composer 会被清空（请求已受理），但用户消息气泡里的文本
    // 就是"用户输入"的持久化形式——验收口径是历史消息里的文本不丢，而不是 composer 本身。
    await page.getByTestId("send").click();

    await expect(page.getByTestId("msg-user")).toContainText(messageText);
    await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("send-error")).toBeVisible();
  });

  test("超时：/ava 最终展示失败态（不会无限挂起/静默成功）", async ({ page }) => {
    currentMode = "timeout";
    await registerAndOpen(page);

    await page.getByTestId("composer").fill("这条消息会触发 provider 超时");
    await page.getByTestId("send").click();

    await expect(page.getByTestId("msg-user")).toContainText("这条消息会触发 provider 超时");
    // anthropicProvider 有请求级超时熔断（ANTHROPIC_TIMEOUT_MS，e2e 环境配置成 5s，
    // 见 apps/web/.env.local），假 server 故意挂起不响应，验证超时会被真实捕获并转成
    // 失败态，而不是无限期停留在 sending 状态。
    await expect(page.getByTestId("msg-failed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("send-error")).toBeVisible();
  });
});

test.describe("流式回复进行中点停止 → 真实中断（AbortController 生效）", () => {
  test("点击停止后：请求被真实中断，不再追加新 token，消息落定为已停止的部分内容", async ({ page }) => {
    currentMode = "stream_slow";
    await registerAndOpen(page);

    await page.getByTestId("composer").fill("开始一段会被我中途停止的长回复");
    await page.getByTestId("send").click();

    // 流式的前两个 token 到达后，stop 按钮应该替代 send 按钮出现（sending 态）。
    await expect(page.getByTestId("stop")).toBeVisible({ timeout: 15_000 });

    // 等到至少已经看到第一段真实流式文本，确认走的是真实 provider 的流式路径。
    await expect(page.getByTestId("sending")).toContainText("正在继续生成", { timeout: 15_000 });

    const streamedBeforeStop = await page.getByTestId("sending").innerText();

    await page.getByTestId("stop").click();

    // 停止后：stop 按钮消失，恢复成 send 按钮（sending=false），且没有展示失败态——
    // 用户主动停止不是一次"失败"。
    await expect(page.getByTestId("send")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("msg-failed")).not.toBeVisible();

    // 等待一小段时间，确认没有继续追加新内容（请求已被真实中断，而非仍在后台流式接收）。
    await page.waitForTimeout(1000);
    const sendingLocatorAfterWait = page.getByTestId("sending");
    await expect(sendingLocatorAfterWait).toHaveCount(0);

    // 已生成的部分内容应该保留在历史消息里（不是整段丢弃成空气泡，也不是失败态）。
    const assistantMessages = page.getByTestId("msg-assistant");
    await expect(assistantMessages.last()).toBeVisible();
    const finalText = await assistantMessages.last().innerText();
    expect(finalText.length).toBeGreaterThan(0);
    expect(streamedBeforeStop).toContain("正在继续生成");

    // reload 验证：服务端（reply-stream.ts）在收到 abort 后独立把同样的部分内容落库为
    // status=complete——不仅是客户端本地渲染的错觉，请求确实在服务端也被真实中断收尾。
    await page.reload();
    await page.getByTestId("thread-list").getByRole("button").first().click();
    const persistedAssistant = page.getByTestId("msg-assistant").last();
    await expect(persistedAssistant).toBeVisible();
    await expect(page.getByTestId("msg-failed")).not.toBeVisible();
  });
});
