# session-handoff — p18 / sprint-02

> 最后更新：2026-07-09（wrk-ava-p18-3，F09）

## 本轮做了什么
- F09「Agent 选择器接入 AI Store 真实订阅数据」完成并经 `pnpm harness verify
  --sprint p18/02 --feature F09` 门控转 passing（硬依赖 p11:F03 已就绪）。
- agent-select 选项来源改为真实数据：内置默认 Agent + 当前用户/团队在 AI Store
  已订阅的 type="agent" 项目（`store-<itemId>`），无订阅时仍是内置默认；
  发消息路由的 agentId 合法集合与选择器同源，订阅 Agent 端到端生效。

## 改了哪些文件
- 新增 `apps/web/lib/ava-agents.ts`（listAvaAgentOptions，复用 p11-F03 数据层）。
- `apps/web/app/api/ava/capabilities/route.ts`：agents 改为真实数据。
- `packages/ai/src/avaSettings.ts`：normalizeAvaAiSettings 可选 agentOptions 参数
  （默认行为不变）。
- `apps/web/app/api/ava/threads/[id]/messages/route.ts`：归一化时传入订阅集合。
- 新增 `apps/web/e2e/ava-agent-real-data.spec.ts`（3 用例）。

## 仍损坏或未验证
- 无新增已知损坏。已知口径（沿用 p11-F03，非本轮改动）：团队订阅列表以
  `listSubscribedAiStoreItemIds` 为准（按 subscriber+当前团队匹配），与 Store
  「已订阅」视图完全一致。

## 下一步最佳动作
- F09 PR 待 coord-ava 初审后转 coord-main 合并。
- sprint-02 剩余 feature 按各自 owner 并行推进。

## 命令
- 启动：`pnpm -w run dev`
- 验证：`pnpm harness verify --sprint p18/02 --feature F09`
- 调试：`pnpm --filter @repo/web exec playwright test e2e/ava-agent-real-data.spec.ts --reporter=list`
