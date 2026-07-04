# 进度日志 — Sprint p18/02

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F04/F07/F09/F11（sprint-02 其余 not_started feature，各自独立 owner 认领）
- 当前 blocker: 无（F02 已 passing）

## 会话记录
### 2026-07-03 10:52:35
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-03（wrk-ava-p18-2，F02：真实模型下的失败态与停止生成）
- 本轮目标：F02 —— 真实 provider（anthropicProvider）不可用时的失败态展示 + 流式回复的
  真实停止生成（AbortController 生效），基于 F01 已接入的 anthropicProvider。
- 已完成：
  1. 单测补齐 `packages/ai/src/anthropicProvider.test.ts`：网络错误（fetch reject）、
     调用方提前 abort、请求级超时（新增 `ANTHROPIC_TIMEOUT_MS`/`timeoutMs` 熔断）、
     429 限流回归用例，共新增 5 条（原 7 条 → 12 条）。
  2. `packages/ai/src/anthropicProvider.ts` 新增请求级超时：`AbortSignal.any([调用方 signal,
     AbortSignal.timeout(timeoutMs)])` 合并信号真实中断 fetch；区分「调用方主动停止」
     （原样抛 AbortError）与「超时触发」（转成可读的超时错误，走正常失败态路径）。
  3. `packages/ai/src/gateway.ts` / `graph.ts`：`StreamChatInput`/`GraphState`/
     `makeGenerateNode` 新增可选 `signal` 字段，把调用方 abort signal 一路透传到 provider。
  4. `apps/web/app/api/ava/threads/[id]/messages/route.ts` + `reply-stream.ts`：把
     `req.signal`（Next.js Request 标准 abort signal）接入 `createAvaReplyStreamResponse`
     → `runChatGraph`；服务端检测到 abort 后把已生成的部分内容落库为 `status=complete`
     （而非 failed），SSE enqueue/close 都做了"连接已断开"的静默降级，不抛未处理异常。
  5. `apps/web/app/(app)/ava/page.tsx`：新增 `streamAbortRef` + `stop()`；sending 态下
     Send 按钮变成 Stop 按钮（`data-testid="stop"`）；点击后 `AbortController.abort()`
     真实中断 fetch；客户端 catch 到 AbortError 时把 `streamingText` 就地落定成一条
     assistant 消息（不展示失败态——停止不是失败），避免依赖已经断开的 SSE 连接再收
     一次服务端事件。
  6. 新建 `apps/web/e2e/ava-real-model-failure.spec.ts`：起一个假 Anthropic 兼容
     HTTP server（监听固定端口，配置在 `apps/web/.env.local` 的 `ANTHROPIC_BASE_URL`），
     覆盖 429/网络错误（socket destroy）/超时（挂起不响应）/流式中途停止四个场景，全部
     走真实 provider 代码路径（只是网络对端是本地假 server）。
  7. 修复 `apps/web/playwright.config.ts` 的环境变量加载 bug：原 `loadEnvFile` 只在
     `process.env[key] === undefined` 时才用 `.env.local` 的值（用于避免覆盖真实凭证），
     但沙箱/开发机环境里 `ANTHROPIC_BASE_URL` 可能已被外部工具设成真实端点，导致
     worktree 本地的假 server 配置被静默吃掉、e2e 实际打到了真实 Anthropic API。
     新增 `FORCE_OVERRIDE_KEYS`（`ANTHROPIC_API_KEY`/`ANTHROPIC_BASE_URL`/
     `ANTHROPIC_TIMEOUT_MS`）强制以 `.env.local` 为准，其余 key 语义不变。
- 运行过的验证：
  - `pnpm --filter @repo/ai test`（34 passed，含新增 5 条 F02 用例）
  - `pnpm --filter @repo/web exec tsc --noEmit -p .`（无报错）
  - `pnpm --filter @repo/web exec playwright test e2e/ava-real-model-failure.spec.ts`
    （4 passed：429/网络错误/超时/停止生成）
  - 回归：`ava-chat-basic` / `ava-ai-settings` / `ava-message-actions` /
    `ava-edit-delete-message`（20 passed，无破坏）
  - `./init.sh`（45/45 tasks successful，基础验证未引入新失败）
  - `pnpm harness verify --sprint p18/02 --feature F02` → 门控通过，F02 转 passing
- 已记录证据：`phases/phase-p18-ava-ai-realization/sprints/sprint-02/evidence/F02.verify.log`（已 `git add -f`，
  gitignore 白名单 `phases/**/evidence/*.log` 命中，确认在 git 树中）。
- 提交记录：见本次 PR（Closes #256）。
- 已知风险或未解决问题：
  - 假 Anthropic server 端口写死在 `apps/web/.env.local`（`E2E_PORT + 1000`），与其它
    worktree 的假 server 端口理论上可能撞车（概率低，未做端口动态分配基础设施）。
  - 停止生成后客户端本地落定的 assistant 消息用负数临时 id，reload 后由服务端真实持久化
    记录替换，不影响正确性，但如果同一渲染帧多次触发需注意（已用递减 id 规避直接撞车）。
- 下一步最佳动作：sprint-02 剩余 F04/F07/F09/F11 按 owner 并行推进；F07（语音输入）与
  本 feature 触碰同一 `page.tsx` 文件，已把改动限制在 send/stop 局部区域降低冲突面。
