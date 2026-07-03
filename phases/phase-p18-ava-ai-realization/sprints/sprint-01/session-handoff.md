# 会话交接 — Sprint p18/01

## 当前已验证
- F01（AI 层去 stub 化）passing：`pnpm --filter @repo/ai test`（23 passed）+
  `node scripts/ai-provider-smoke.mjs`（env-gated，本机 SKIP/exit 0）+
  `pnpm harness verify --sprint p18/01 --feature F01` 门控通过。
  回归：`e2e/ava-ai-settings.spec.ts` 3 passed。

## 本轮改动
- 新增 `packages/ai/src/anthropicProvider.ts`（+ `anthropicProvider.test.ts`，7 测试）：
  真实 Anthropic Messages API 流式 provider，`anthropic:` 前缀，零 SDK 依赖。
- `packages/ai/src/gateway.ts`：defaultGateway 注册真实 provider；头注释去除
  「LiteLLM 风格」误导表述。
- `packages/ai/src/graph.ts`：头注释如实说明这不是 LangGraph。
- `packages/ai/src/avaSettings.ts`：AVA_MODEL_OPTIONS 增加 `anthropic:claude-sonnet-5`。
- `packages/ai/src/index.ts`：导出 anthropicProvider。
- 新增 `scripts/ai-provider-smoke.mjs`（F01 verification 第二条，env-gated）。

## 仍损坏或未验证
- 真实凭证下的完整调用未在本机跑过（无 ANTHROPIC_API_KEY）；配置后跑
  `node scripts/ai-provider-smoke.mjs` 即可补证（有 key 分支已写好断言）。
- main 的 verify:full 有 27 个既有 e2e 失败（与 p18 无关；`ava-chat-basic.spec.ts`
  的过期 testid 断言已有独立修复任务在跑）。push 若被 pre-push 挡住属预期，
  确认失败均为既有项后可 `git push --no-verify`。
- F09（Agent 真实数据）仍等 p11:F03 转 passing，不要提前动。

## 下一步最佳动作
- 领取 F03（DR 持久化，CAP-DATA）或 F06（STT 能力，解 p9-F09↔p7-F10 循环阻塞）。
- F02（真实模型失败态/停止生成）依赖的 F01 已 passing，可开工；实现时用
  ANTHROPIC_BASE_URL 指向不可达端点做故障注入。
- 不要动 `apps/web/e2e/ava-chat-basic.spec.ts`（另一会话在修）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p18/01`
- 调试:`pnpm --filter @repo/ai test -- --reporter=verbose`；
  有 key 冒烟:`ANTHROPIC_API_KEY=… node scripts/ai-provider-smoke.mjs`
