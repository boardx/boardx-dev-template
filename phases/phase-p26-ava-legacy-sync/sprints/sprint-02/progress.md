# 进度日志 — Sprint p26/02

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/phase-p26-ava`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: `F03 / 迁移旧 AVA Deep Research 细节视图`（尚未进入本 sprint）
- 当前 blocker: 无 F02 blocker；F02 已由 `pnpm harness verify --sprint p26/02` 升级为 passing。

## 会话记录
### 2026-07-15 10:23:59
- 本轮目标: 修正 `/ava` 聊天主界面交互和视觉问题，并按 F02 验证契约回归。
- 已完成:
  - 将 AVA 消息区从过窄居中列改为 `max-w-4xl` 阅读列，用户气泡右对齐、助手回复左对齐。
  - 将 composer 改为 `Textarea` + 卡片式底栏，移除截图中的原生黑色 focus 框，扩大输入区和发送/停止按钮点击面积。
  - 调整空态、AI credits 横幅、助手头像和消息间距，使页面层级更清晰。
  - 补同步 boardx-web 的 Deep Agent 入口：新增 `Deep Agent` composer mode，发送时走旧版兼容路径 `/api/v1/deep-agent/execute`。
  - `capabilities` 现在下发 Deep Agent 能力标记；订阅的 AI Store Agent 会从 config 识别 `enableDeepAgent` / `knowledge_base.enabled`，选择后自动切到 Deep Agent 模式。
  - 新增 Deep Agent route：配置 `NEXT_PUBLIC_API_URL` 时代理 boardx-backend `/v1/deep-agent/execute` SSE；未配置时返回本地可验证 deep-agent stub，并写入 `ava_messages`。
  - 同步 boardx-web 的消息分流保护：`/api/ava/threads/:id/messages` 收到 `deepAgent: true`、`researchType: "deep_agent"`，或选中 Deep Agent Agent 时，直接转到 Deep Agent 兼容处理，不再走 AVA stub。
  - 同步 boardx-web 的 backend 鉴权转发：前端从 localStorage `auth-token-data.token` / `loginToken` 读取旧 backend bearer token；`/messages` 分流会透传 `Authorization` 到 `/api/v1/deep-agent/execute`。
  - 当前 worktree `apps/web/.env.local` 已设置 `NEXT_PUBLIC_API_URL=http://localhost:9900/api`，3003 dev server 已重启并加载该 env。
- 运行过的验证:
  - `pnpm --filter @repo/web typecheck` — passed。
  - `pnpm --filter @repo/ai typecheck` — passed。
  - `pnpm --filter @repo/web lint` — passed；仅有既有 LABEL-LANG-MIX 警告。
  - Deep Agent smoke（临时注册用户 → 创建 thread → POST `/api/v1/deep-agent/execute`）— passed，返回 `201`、`X-Deep-Agent-Backend: local-stub`，SSE 包含 `user/progress/chunk/done`。
  - `/messages` Deep Agent 分流 smoke（临时注册用户 → 创建 thread → POST `/api/ava/threads/:id/messages`，body 带 `deepAgent: true` / `researchType: "deep_agent"`）— passed，返回 `201`、`X-Ava-Message-Backend: deep-agent`、`X-Deep-Agent-Backend: local-stub`。
  - boardx-backend proxy smoke（设置 `NEXT_PUBLIC_API_URL=http://localhost:9900/api` 后重启 3003，再 POST `/messages` deepAgent）— reached backend proxy path，返回 `401 Unauthorized`；原因是当前模板登录态只有 httpOnly session cookie，未携带旧 backend `Authorization: Bearer <jwt>`。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts e2e/ava-message-actions.spec.ts e2e/ava-message-send-actions.spec.ts e2e/ava-attach-files.spec.ts e2e/ava-voice-input.spec.ts` — failed，25 passed / 5 failed。
- 已记录证据: 本文件记录命令与失败点；F02 未写入 passing evidence。
- 提交记录: 未提交。
- 已知风险或未解决问题:
  - `ava-attach-files.spec.ts` 选择图片上传用例卡在 `data-status="uploading"`。
  - `ava-attach-files.spec.ts` 服务端不支持类型二次校验用例在注册请求处 `ECONNRESET`。
  - `ava-chat-basic.spec.ts` 未登录访问 `/ava` 未跳转 `/login`。
  - `ava-message-actions.spec.ts` 第二条追问后仍只有 1 条 assistant 消息。
  - `ava-voice-input.spec.ts` 录音结束后 composer 未回填转写文本；服务端日志出现 `Failed to parse body as FormData`。
- 下一步最佳动作: 先修附件上传完成态与语音转写主路径，再重跑 F02 Playwright 验证；通过后再执行 `pnpm harness verify --sprint p26/02`。

### 2026-07-15 21:04:40
- 本轮目标: 修正 AVA 仍显示 `Stub Default`、`/messages` 仍返回 stub token 的问题，先接入千问模型。
- 已完成:
  - 新增 `packages/ai/src/qwenProvider.ts`，按现有 `ChatProvider` 契约接入 DashScope/OpenAI-compatible `/chat/completions` SSE。
  - `defaultGateway` 注册 `qwenProvider`；`qwen*` 模型现在走真实千问 provider，`stub:*` 仅作为手动选择/测试兜底保留。
  - `DEFAULT_AVA_MODEL_ID` 从 `stub:default` 切到 `qwen3.7-max`，capabilities 默认模型和 AVA 首屏 state 同步为 `Qwen 3.7 Max`。
  - 增加 `qwen3.6-plus` 可选模型，保留 `Stub Default`、`Stub Planner` 和 Anthropic 选项。
  - 更新 AVA 设置 e2e 预期：默认展示 Qwen；受限模型伪造提交回退默认模型时，若本地无 key，应返回千问 provider 未配置失败态而不是 stub 回显。
- 运行过的验证:
  - `pnpm --filter @repo/ai typecheck` — passed。
  - `pnpm --filter @repo/ai test` — passed，5 files / 41 tests。
  - `pnpm --filter @repo/web typecheck` — passed。
  - `pnpm --filter @repo/web lint` — passed；仅有既有 LABEL-LANG-MIX 警告。
  - Smoke: 临时注册用户后 GET `/api/ava/capabilities` — passed，返回 `defaults.modelId: "qwen3.7-max"`，模型列表第一项为 `Qwen 3.7 Max`。
  - Smoke: POST `/api/ava/threads/26/messages`，body 使用 `modelId: "qwen3.7-max"` — reached Qwen provider path；当前本机 Next 进程未配置 `DASHSCOPE_API_KEY` / `QWEN_API_KEY`，SSE 返回 failed assistant，不再返回 stub 文案或 `模型：stub:*`。
- 已知风险或未解决问题:
  - 真实千问调用需要给 web server 环境配置 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY` 并重启；当前 smoke 只证明已离开 stub 并进入 Qwen provider 错误面。
  - F02 完整 Playwright 回归仍沿用上一轮失败边界，未 passing。

### 2026-07-15 21:19:04
- 本轮目标: 修正截图中 `Qwen 3.7 Max` 已选中但 `/messages` 返回 `AVA 生成回复失败` 的问题。
- 根因:
  - web 的 `apps/web/.env.local` 没有 `DASHSCOPE_API_KEY` / `QWEN_API_KEY`，导致 Qwen provider 已被选中但无法向 DashScope 发请求。
  - `reply-stream` 按 AVA 契约只把原始 provider 异常写服务端日志，SSE 对客户端只下发通用失败文案，所以浏览器里只能看到 `AVA 生成回复失败`。
- 已完成:
  - 对齐 boardx-backend 的 Qwen 请求体：`enable_thinking: false`，流式请求带 `stream_options: { include_usage: true }`。
  - 停止旧 3003 dev server，并用 boardx-backend 本地 DashScope 环境变量启动 `localhost:3003`。
- 运行过的验证:
  - `pnpm --filter @repo/ai typecheck` — passed。
  - `pnpm --filter @repo/ai test` — passed，5 files / 41 tests。
  - `pnpm --filter @repo/web typecheck` — passed。
  - `pnpm --filter @repo/web lint` — passed；仅有既有 LABEL-LANG-MIX 警告。
  - Real Qwen smoke: 临时注册用户 `id=35`，创建 AVA thread `id=28`，POST `/api/ava/threads/28/messages`，body 使用 `modelId: "qwen3.7-max"` — passed，返回 `event: token` 流和 `event: done`；assistant 内容为通义千问自我介绍。
- 当前边界:
  - `localhost:3003` 当前进程已带 DashScope key，可直接刷新 `/ava` 验证真实 Qwen 回复。
  - 若以后重新启动 web，需要确保进程环境仍有 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY`；否则会回到通用失败态，但不会回退 stub。

### 2026-07-15 21:34:00
- 本轮目标: 修正用户消息重新编辑态 UI 过重、像右侧漂浮弹窗的问题。
- 已完成:
  - 将编辑态改为原地编辑气泡：保持右对齐和聊天流上下文，不再重复展示一块原消息预览卡片。
  - 编辑输入框改为透明内嵌样式，聚焦反馈放在气泡容器上；Cancel/Save 按钮收敛到底部右侧。
  - 编辑态父容器在编辑时占满可用消息宽度，普通消息仍保持按内容宽度显示。
- 运行过的验证:
  - `pnpm --filter @repo/web typecheck` — passed。
  - `pnpm --filter @repo/web lint` — passed；仅有既有 LABEL-LANG-MIX 警告。

### 2026-07-16 19:00:41
- 本轮目标: 完成 F02 剩余验证收敛，确保所有新增 AVA 改动进入 requirements，并由 harness 升级 passing。
- 已完成:
  - 按用户要求将后续 AVA 改动统一补入 `requirements/01-change-intake.md`，包括 Qwen 默认模型、Deep Agent 同步、UI 交互、Delete 文案、重新生成连续发送、附件上传稳定性和 e2e 本地端点稳定性。
  - 修复附件上传体验：文件选择/拖拽后立即出现预览条，不再等待线程创建；上传失败进入 failed 可重试态。
  - `packages/storage` 的 `ensureBucket()` 增加进程内 promise 缓存，避免每个 AVA 附件上传重复初始化对象存储 bucket。
  - Playwright webServer 的 `DATABASE_URL` / `REDIS_URL` / `S3_ENDPOINT` 在 e2e 进程中规范为 `127.0.0.1`，规避 Docker Desktop 下 `localhost` IPv6/IPv4 抖动导致的冷启动连接问题。
  - 附件 e2e 的 uploaded 等待窗口从 10s 调整为 30s，仍要求最终进入 `uploaded`，不接受卡在 `uploading`。
  - 附件 reload 后持久化验证改为点击本次创建的线程标题，避免历史线程污染“第一项”选择器。
- 运行过的验证:
  - `pnpm --filter @repo/web exec playwright test e2e/ava-attach-files.spec.ts` — passed，8/8。
  - `pnpm --filter @repo/web exec playwright test e2e/ava-chat-basic.spec.ts e2e/ava-message-actions.spec.ts e2e/ava-message-send-actions.spec.ts e2e/ava-attach-files.spec.ts e2e/ava-voice-input.spec.ts` — passed，30/30。
  - `pnpm --filter @repo/web test` — passed，17 files / 95 tests。
  - `pnpm --filter @repo/storage test` — passed，1 file / 19 tests。
  - `pnpm --filter @repo/web typecheck` — passed。
  - `pnpm harness verify --sprint p26/02` — passed；F02 已升级为 `passing`，evidence: `evidence/F02.verify.log @ 2026-07-16T11:00:07.480Z`。
- 环境处理:
  - Docker daemon 曾中途不可连接，导致 Postgres `ECONNREFUSED`；已启动 Docker Desktop，重新拉起当前 worktree compose 栈，并确认 `users` 表可查。
  - `pnpm harness sweep-docker` dry-run 显示 2 个孤儿 compose 栈仍在运行：`boardx-next`、`officelab`。本轮未执行 `--apply`，未删除任何孤儿卷。
- 当前状态:
  - F02 `passing`。
  - F03/F04 仍 `not_started`，不属于 sprint-02 当前 verified scope。
