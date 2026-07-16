# 增量需求与变更录入规则

## 需求录入纪律

从 2026-07-16 起，本 phase 后续所有用户提出的 AVA 行为、UI、接口、模型、文案或验证口径调整，都必须同步写入 `requirements/`。

执行规则：
- 动手实现前或实现同一轮内，先把用户原话/可观察行为补到本目录的需求文件。
- 如果变更影响验收边界，必须同步更新 `../feature_list.json` 的 `user_visible_behavior`、`verification` 或 `notes`。
- 只写 `progress.md` / `session-handoff.md` 不算需求录入；它们只能记录执行过程和证据。
- 不允许为了快速修 UI 或文案跳过需求留痕。

## 已追加的 AVA 需求

### Qwen 默认真实模型

用户进入 AVA 页面时，默认模型应优先使用 boardx-backend 已接入的千问模型，而不是 `Stub Default`。

可观察行为：
- 模型选择器默认显示 `Qwen 3.7 Max`。
- 普通 `/messages` 请求使用 `qwen3.7-max` 时应进入千问 provider，不返回 AVA stub 文案。
- 本地 web server 注入 `DASHSCOPE_API_KEY` 或 `QWEN_API_KEY` 后，发送消息能返回千问 token 流和 `done`。
- 缺少 key 时应展示稳定失败态，不能静默回退 stub。
- 旧 `/api/v1/chat/handleRequestAIChat`、widget、digitize 等兼容接口不属于新版 AVA 页面默认模型选择；旧 provider 名或未显式传入新版模型时仍使用 deterministic stub，避免兼容调用方和 base test 被真实千问凭证耦合。

### Deep Agent 同步

旧 `boardx-web` 中 AVA 的 Deep Agent 入口需要在当前 AVA composer 中有等价入口，并优先走 `boardx-backend` Deep Agent 处理。

可观察行为：
- composer 中有 `Deep Agent` 模式入口。
- 选择支持 Deep Agent 的 AI Store Agent 时自动进入 Deep Agent 模式。
- Deep Agent 请求走 `/api/v1/deep-agent/execute`；配置 `NEXT_PUBLIC_API_URL` 时代理到 boardx-backend。
- `/api/ava/threads/:id/messages` 收到 `deepAgent: true`、`researchType: "deep_agent"` 或 Deep Agent Agent 时，不应落回普通 AVA stub。

### AVA 消息区与 composer UI

AVA 页面需要比当前旧实现更接近可用聊天产品，而不是窄列、黑色原生 focus 框或漂浮卡片感。

可观察行为：
- 消息阅读列在桌面端有足够宽度，用户消息右对齐，助手消息左对齐。
- composer 使用设计系统输入控件和稳定 focus 状态，不出现原生黑色输入框边框。
- 用户消息重新编辑时应在原消息位置内联编辑，不出现右侧漂浮弹窗样式，不重复展示一块原文预览卡。

### 消息操作文案

用户消息操作中的删除按钮文案应简洁。

可观察行为：
- 最后一条用户请求旁边的删除操作按钮显示为 `Delete`。
- 删除确认流程仍说明删除最后一次请求及其回复，原有删除逻辑和测试锚点保持不变。

### F02 剩余验证收敛

F02 的 Playwright 契约必须在没有真实外部模型凭证的测试环境中保持确定性，同时不改变本地/生产默认 Qwen 行为。

可观察行为：
- Playwright webServer 环境中 AVA 默认使用 `stub:default`，保证 Markdown、代码块、消息动作、发送到 Board、发送邮件等回归测试不依赖真实 DashScope key。
- 普通本地运行仍默认显示并使用 `Qwen 3.7 Max`。
- 未登录访问 `/ava` 时应跳转到 `/login`，不能展示空壳应用布局。
- composer 附件入口和拖拽上传都应从 `uploading` 进入 `uploaded`，并能随消息进入聊天历史。

### 重新生成后的连续发送

用户点击 assistant 回复的 `Regenerate` 后，原问题不能丢失；重新生成进行中只能阻止重复点击同一类消息操作，不能让 composer 的下一次普通发送被短暂 pending 状态吞掉。

可观察行为：
- `Regenerate` 展示独立的 `AVA is regenerating...` 状态。
- 重新生成完成前后，composer 中的新输入点击发送都应进入普通 `/messages` 路径并生成新的 assistant 回复。
- 消息操作条仍只允许最后一条 assistant 显示 `Regenerate`，不会并发触发多个 regenerate 请求。

### 附件上传即时反馈与稳定完成

AVA composer 选择文件或拖拽文件后，应立即给用户可见反馈，不能等线程创建或对象存储初始化完成后才出现预览。

可观察行为：
- 选择图片或拖拽文件后，`attachment-preview-strip` 立即出现，并先展示 `uploading` 状态。
- 线程创建、MinIO bucket 检查或对象写入成功后，预览项进入 `uploaded`。
- 本地 e2e 中连续附件上传不能因为每次重复初始化对象存储 bucket 而长期卡在 `uploading`。
- 上传失败时仍进入 `failed` 可重试状态，不静默卡住发送按钮。
- Playwright webServer 使用本地 Docker 服务时，应避免 `localhost` 在 IPv6/IPv4 之间抖动导致冷启动连接延迟或 `ECONNREFUSED`，本地依赖端点可以规范到 `127.0.0.1`。
- 附件持久化验证在 reload 后必须回到本次创建的线程再检查图片缩略图，不能依赖线程列表第一项，以免历史数据污染验证。

### AVA 真实模型默认生效与 composer 内层边框

用户在普通本地 dev 环境进入 AVA 或点击 New chat 后，模型选择应默认回到 Qwen，而不是保留旧页面/旧线程里曾经选过的 `Stub Default`。composer 输入框也不能出现截图中的原生黑色内层边框。

可观察行为：
- `/ava` 能力加载完成后，模型选择器默认显示 `Qwen 3.7 Max`。
- 点击 `New chat` 后，模型选择重置为 capabilities 返回的默认模型。
- 普通发送默认使用 `qwen3.7-max`；只有用户显式选择 `Stub Default` 或 e2e 注入 stub env 时才走 stub。
- composer 输入框聚焦时只显示外层设计系统 focus 状态，不出现 textarea 自身黑色边框/outline。

### 本地 DashScope 配置

本地 AVA/SURVEY 真实模型调试需要支持通过 `apps/web/.env.local` 配置 DashScope。

可观察行为：
- `DASHSCOPE_API_KEY` 存在时，AVA Qwen provider 不再报缺少 key。
- `DASHSCOPE_BASE_URL` 可配置为 `https://dashscope.aliyuncs.com/compatible-mode/v1`。
- `SURVEY_AI_MODEL` 可配置为 `qwen3.7-max`，供 Survey AI 路由读取。
- 密钥只写本地 env，不进入 git commit / PR。
