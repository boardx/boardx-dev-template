# 进度日志 — Sprint p18/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F03（DR 持久化）/ F06（STT 能力）—— 均 wave 0 可并行
- 当前 blocker: 无

## 会话记录
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
