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

### 2026-07-04（wrk-ava-p18-3，F07）
- 本轮目标：F07 语音输入端到端接通——把 `apps/web/app/(app)/ava/voice-input.tsx` 里
  `MOCK_TRANSCRIPTS` 随机占位文案替换为真实转写（F06 落地的 `packages/ai` STT provider）。
- 已完成：
  - 新增 `apps/web/app/api/ava/transcribe/route.ts`：鉴权（`currentUser`）→ 读 multipart
    `file` 字段 → 调 `@repo/ai` 的 `transcribeAudio`（OpenAI Whisper API）→ 返回 `{text}`；
    无 `OPENAI_API_KEY` 时走路由内置确定性 stub 回退（口径对齐 `packages/ai/src/gateway.ts`
    的 `stubProvider`），保证本地/CI 无供应商额度时端到端链路仍可被 e2e 真实覆盖。
  - `voice-input.tsx`：`recorder.ondataavailable` 收集音频 chunk，`onstop` 里组装
    `Blob` → `FormData` → POST `/api/ava/transcribe`，成功回填 `onTranscribed(text)`，
    失败走已有 `transcription-failed` 错误分支；删除"STT 服务未就绪"相关过时注释。
  - `playwright.config.ts`：chromium project 加
    `--use-fake-device-for-media-stream` / `--use-fake-ui-for-media-stream`，仅影响
    该 project 的浏览器启动参数。
  - 新增 `apps/web/e2e/ava-voice-input.spec.ts`：覆盖正常路径（录音→真实转写文本回填）、
    取消录音（不产生文本）、转写请求失败（展示 transcription-failed 文案）。
  - 排查记录：e2e 中若同时调用 `context.grantPermissions(["microphone"])` 会与
    fake-ui 标志的自动授权互相干扰，导致 `getUserMedia` 挂起不 resolve——已去掉该调用，
    仅依赖 launchOptions 的 fake-ui/fake-device 标志。
- 运行过的验证：
  - `pnpm --filter @repo/web exec playwright test e2e/ava-voice-input.spec.ts`（3 passed，
    重复跑两次均稳定通过）
  - `pnpm harness verify --sprint p18/02 --feature F07`（含 `verify:base` 全量 45 个任务通过）
- 已记录证据：`phases/phase-p18-ava-ai-realization/sprints/sprint-02/evidence/F07.verify.log`
- 提交记录：见后续 commit（Closes #258）
- 已知风险或未解决问题：无 `OPENAI_API_KEY` 环境下走的是路由层 stub 转写，不是真实 Whisper
  调用；真实 STT 链路由 F06 的 `node scripts/stt-smoke.mjs`（env-gated）冒烟覆盖。
- 下一步最佳动作：F07 已 passing；下一 feature 由 coordinator 派发。

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

## 会话记录：F11 — 消息「发送到 Board」「发送邮件」接通（wrk-ava-p18-3）
- 现状确认：`apps/web/app/(app)/ava/page.tsx` 的 `MessageActionsBar` 里
  `msg-send-to-board`/`msg-send-email` 原为永久 disabled 占位（无 onClick），现接通为真实动作。
- 硬前置（coordinator 登记，PR #321 review）：接真实邮件 provider/复用邮件底层前必须先加频控。
  实现：`packages/data/src/mailbox.ts` 新增 `countRecentOutboundEmails(toEmail, kind, windowMs)`，
  查既有 `outbound_emails` 表内该收件人+该邮件类型在时间窗口内的计数，不引入 Redis/内存 Map。
  `apps/web/lib/mailer.ts` 新增 `sendAvaMessageEmail`（复用 `recordOutboundEmail` 同一 dev
  transport 口径），发送前先查计数，1 分钟内超过 1 封时抛 `RateLimitedError`；路由层捕获后
  返回 429 + 独立提示（不与「发送到 Board」共用状态）。
- 发送到 Board：
  1. `packages/data/src/board.ts` 新增 `listEditableBoardsForUser(userId)`——白板属主，或
     可访问其所属房间（owner/成员），口径与既有 `boardRole` 一致；不含仅 viewer 的只读白板。
  2. `apps/web/app/api/boards/route.ts` 新增 `GET ?scope=editable`。
  3. 新路由 `apps/web/app/api/ava/threads/[id]/messages/[messageId]/send-to-board/route.ts`：
     鉴权同时校验 user_id/team_id（复用 `isThreadInCurrentContext`）+ 目标消息属于该线程且
     为 assistant 角色 + `getBoardAccessRole` 为 owner/editor（否则 403「无编辑权限」）；写入
     方式与既有 `apps/web/app/api/boards/[id]/items/route.ts` 的 POST 完全一致：
     `insertItem({ type: "note", x: 40, y: 40, w/h: DEFAULT_SIZE.note, text: message.content })`。
- 发送邮件：新路由 `apps/web/app/api/ava/threads/[id]/messages/[messageId]/send-email/route.ts`，
  鉴权同上，调用 `sendAvaMessageEmail({ to: user.email, messageContent, threadTitle })`；
  捕获 `RateLimitedError` 返回 429。
- 前端：`MessageActionsBar` 新增最小可用的白板选择器（`data-testid="board-picker"`，popover +
  列表，选项 `board-picker-option-{id}`，空态 `board-picker-empty`，加载失败 `err-board-list`），
  成功/失败提示独立 testid：`msg-board-status`/`err-msg-board`、`msg-email-status`/`err-msg-email`。
- 修改既有 `e2e/ava-message-actions.spec.ts`：原「禁用占位不可点击」断言改为「默认可点击」
  （行为已从占位转真实动作，详细场景覆盖移到新 spec）。
- 新增 `apps/web/e2e/ava-message-send-actions.spec.ts`（5 用例，全过）：
  发送到 Board 成功路径（含真实写入断言 `/api/boards/:id/items`）、无编辑权限空态、
  非属主 board 直接调用接口 403、发送邮件成功（`/api/dev/outbox?kind=ava_message_email`
  断言真实落库）、频控命中（连续两次点击第二次被拦截，未产生第二封邮件）。
- 运行过的验证：
  - `pnpm --filter @repo/web exec tsc --noEmit -p .`（无报错）
  - `pnpm --filter @repo/web run lint`（design lint 全部通过；此前一版误用原生 `<button>`
    渲染 board picker 选项，被 lint 拦下后改为 `components/ui/button` 的 `Button`）
  - `pnpm --filter @repo/web exec playwright test e2e/ava-message-send-actions.spec.ts`
    （5 passed）
  - 回归：`ava-message-actions.spec.ts` + `ava-share-email.spec.ts`（13 passed，F08/F09
    邮件分享与既有消息操作条行为无破坏）
  - `pnpm -w run verify:base`（45/45 successful，exit 0）
  - `pnpm harness verify --sprint p18/02 --feature F11` → 门控通过，F11 转 passing
- 已记录证据：`phases/phase-p18-ava-ai-realization/sprints/sprint-02/evidence/F11.verify.log`。
- 提交记录：见本次 PR（Closes #260）。
- 已知边界（如 notes 字段所述）：写入 Board 的内容是「便利贴文本」这一最小可用形态，不含
  widget 级富投放（依赖 p6 未交付部分时按此边界落地，未虚报为完整对齐）；放置坐标固定在
  画布原点附近（(40,40)），因触发来源是 AVA 侧栏而非打开的画布，没有可参考的视口/鼠标位置。
- 下一步最佳动作：sprint-02 剩余 feature 按各自 owner 继续推进；F11 完成后 04 号需求文档
  四项占位（F04/F07/F08/F11）中 F11 已收口。

## 2026-07-09 — F09 Agent 选择器接入 AI Store 真实订阅数据（wrk-ava-p18-3）

- `pnpm harness verify --sprint p18/02 --feature F09` 门控通过，F09 转 passing。
- 实现（最小改动，客户端零改动——/ava 本就从 `/api/ava/capabilities` 取 agents）：
  - 新增 `apps/web/lib/ava-agents.ts`：`listAvaAgentOptions(userId, teamId)` =
    内置 `AVA_AGENT_OPTIONS` + 当前用户/团队已订阅、type="agent" 的 AI Store 项目
    （选项 id 为 `store-<itemId>`）。订阅口径完全复用 p11-F03 数据层
    `listSubscribedAiStoreItemIds` + `getAiStoreItem`，与 Store「已订阅」列表同一套判定。
  - `apps/web/app/api/ava/capabilities/route.ts`：`agents` 从硬编码常量改为
    `await listAvaAgentOptions(...)`。
  - `packages/ai/src/avaSettings.ts`：`normalizeAvaAiSettings` 增加可选第三参
    `agentOptions`（默认仍为内置常量，历史行为不变）；
    `apps/web/app/api/ava/threads/[id]/messages/route.ts` 发消息时传入同一份
    「内置+订阅」集合，选中订阅 Agent 发送不再被归一化回 default。
  - 新增 `apps/web/e2e/ava-agent-real-data.spec.ts`（3 用例，全过）：
    无订阅只有内置默认；订阅 agent+template 后刷新只有 agent 进选择器、选中发送 stub
    回显 `Agent：store-<id>`、线程有消息后 agent-locked 禁用态保持；取消订阅后刷新移除。
- 回归（全过）：`ava-ai-settings`（3）+ `ava-ui-parity`（4，F13 composer-agent-pill 结构
  不受影响）+ `ava-chat-basic`（5）+ `ai-store-003-subscribe-use-item`（5）+
  `share-view-chat-states`（5，含 agent-select 禁用态用例）。
- `pnpm -w run verify:base` 通过（由 harness verify 的 require_base_pass 一并执行）。
- 证据：`evidence/F09.verify.log`。提交见 PR（Closes #259）。
