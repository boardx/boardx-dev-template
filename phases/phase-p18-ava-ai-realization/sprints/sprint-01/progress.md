# 进度日志 — Sprint p18/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F06（STT 能力）/ F08（分享邮件）/ F10（附件富渲染，等 PR #295 合并）
- 当前 blocker: 无（F03 有并行会话在做，勿重复认领）

## 会话记录
### 2026-07-04 (owner: wrk-ava-p18-1)
- 本轮目标: F12 — 分享只读页四态 e2e 补齐 + Agent 禁用态断言
- 已完成:
  - 新增 `apps/web/e2e/share-view-chat-states.spec.ts`（5 用例）：Loading 态用路由拦截
    做确定性断言（此前骨架屏从未被验证）、Invalid、Unavailable（含关闭分享后 token
    立即失效）、Empty、以及 /ava 的 agent-select 禁用态 + agent-locked 提示（点击前可见）
  - 未改任何实现代码——四态实现 p9-F05 已就绪，本 feature 为验证覆盖补齐
- 运行过的验证: playwright 5 passed；`pnpm harness verify --sprint p18/01 --feature F12`
  门控通过 → passing（含 verify:base）
- 已记录证据: evidence/F12.verify.log
- 提交记录: 本分支 worker/wrk-ava-p18-f12-share-four-states（堆叠在 F01 分支上，
  以满足单一 in_progress 不变量——F01 的 passing 状态来自 #295 的门控产出）
- 已知风险或未解决问题: F03 被并行会话以无主 in_progress 占用（其 verify 尚未通过），
  属 ADR-001 允许的单个无主额度，但建议该会话尽快用 claim 补 owner
- 下一步最佳动作: F06（STT）或 F08（分享邮件）；F10 等 #295 合并后接线
### 2026-07-03 19:20 (owner: wrk-ava-p18-1)
- 本轮目标: F01 — AI 层去 stub 化：真实模型 provider 接入 + 网关路由
- 已完成:
  - 新增 `packages/ai/src/anthropicProvider.ts`：零 SDK 依赖的 Anthropic Messages API
    流式 provider（`anthropic:` 前缀路由；ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL 走 env；
    system 消息单独提取；SSE 跨 chunk 缓冲解析；HTTP/流式错误面完整）
  - `defaultGateway` 注册真实 provider（stub 保留，前缀不重叠）
  - `avaSettings` 增加真实模型选项 `anthropic:claude-sonnet-5`（模型选择器可选中并路由）
  - 修正 `gateway.ts`/`graph.ts` 头部「LangGraph/LiteLLM」误导性描述为如实说明
  - 新增 `scripts/ai-provider-smoke.mjs`（env-gated：无 key SKIP 退出 0，有 key 真实调用
    断言非模板回复）
  - 新增 7 个 provider 单测（路由/请求组装/SSE 解析/错误面/网关并存）
- 运行过的验证:
  - `pnpm --filter @repo/ai test` → 23 passed
  - `node scripts/ai-provider-smoke.mjs` → SKIP（本机无 key），exit 0
  - 回归 `e2e/ava-ai-settings.spec.ts` → 3 passed（新增模型选项未破坏 p9-F07）
  - `pnpm harness verify --sprint p18/01 --feature F01` → 门控通过，F01 = passing
- 已记录证据: evidence/F01.verify.log、evidence/F01-regression-ava-ai-settings.log
- 提交记录: 见本分支 worker/wrk-ava-p18-f01-real-provider
- 已知风险或未解决问题:
  - 本机/CI 无 ANTHROPIC_API_KEY，真实调用路径由冒烟脚本的有-key 分支覆盖，尚未在
    真实凭证下跑过一次——建议配置 key 后手跑 `node scripts/ai-provider-smoke.mjs` 补证
  - main 上 verify:full 存在 27 个与本 feature 无关的既有 e2e 失败（另有任务在修）
- 下一步最佳动作: 领取 F03（DR 持久化）或 F06（STT 能力）；F02（真实模型失败态）依赖
  本 feature 已解锁，也可开工
### 2026-07-04 02:45 (owner: wrk-ava-p18-2)
- 本轮目标: F06 — STT 能力落地（解开 p9-F09 ↔ p7-F10 循环阻塞）
- 已完成:
  - 新增 `packages/ai/src/sttProvider.ts`：零 SDK 依赖的 OpenAI Whisper API 转写
    provider（`transcribeAudio(input): Promise<{text}>`；POST /v1/audio/transcriptions
    multipart，model=whisper-1；OPENAI_API_KEY/STT_BASE_URL/STT_MODEL 走 env；
    缺 key 抛可读错误且不发请求；HTTP 非 200 / 响应缺 text 字段错误面完整；
    可注入 fetchImpl 供单测）
  - `packages/ai/src/index.ts` 导出 STT 能力
  - 新增 `scripts/stt-smoke.mjs`（env-gated：无 key SKIP 退出 0；有 key 用脚本内置
    程序化生成的 0.8s wav 真实调用一次并断言返回非空 text）
  - 新增 6 个 sttProvider 单测（请求组装/multipart 字段/成功解析/缺 text/缺 key/HTTP 错误）
  - 选型决策记录：requirements/03-voice-input-stt.md 末尾「选型决策（F06 落地）」
    （Whisper API：API 成熟、一次 HTTP 即得文本、零依赖风格兼容、STT_BASE_URL 可替换自建端点）
- 运行过的验证:
  - `pnpm --filter @repo/ai test` → 29 passed（含新增 6 个）
  - `node scripts/stt-smoke.mjs` → SKIP（本机无 key），exit 0
  - `pnpm harness verify --sprint p18/01 --feature F06` → 门控通过，F06 = passing
- 已记录证据: evidence/F06.verify.log
- 提交记录: 见本分支 worker/wrk-ava-p18-2-f06-stt-capability
- 已知风险或未解决问题:
  - 本机/CI 无 OPENAI_API_KEY，有-key 分支尚未在真实凭证下跑过——建议配置后手跑补证
  - p9-F09 与 p7-F10 的 depends_on 尚未指向本 feature：跨 phase 权威文件修改是独立
    协调事项（notes 已注明），需 coordinator 排期
- 下一步最佳动作: F07（AVA 语音输入 UI 接线，依赖本 feature 已解锁）
