# 会话交接 — Sprint p30/01

## 当前已验证
- `F01 / Harness V2 核心协议与产品边界` 已确认 `passing`。
- 验证命令: `pnpm --filter @repo/harness-core test`、`pnpm --filter @repo/agent-core test`、`pnpm --filter @repo/orchestrator test`、`pnpm -w run verify:base`。

## 本轮改动
- 新增无运行时依赖的 `@repo/harness-core`，定义版本化核心类型、闭合事件集合和运行时校验。
- `@repo/agent-core` 保留 V1 API，并兼容导出 V2 核心协议。
- ADR-018 明确 Runtime、Control Plane、Eval 与 Delivery Adapter 的权威边界，并说明与 p29 coord-platform 的分工。
- 新建 p30 Phase 与 Sprint 01，后续能力拆为 F02-F07。

## 仍损坏或未验证
- F01 无已知损坏或未验证项。
- 事件存储、checkpoint、workspace sandbox、provider adapter、eval 执行和 p29 集成尚未实现，分别属于 F02-F07。

## 下一步最佳动作
- F01 Review 合并后，从最新 `main_V2` 为 F02 创建独立 Issue、分支和 Delivery PR。
- 不要在 F01 Review 返工中加入 F02-F07 的实现。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p30/01 --feature F01`
- 调试:`pnpm --filter @repo/harness-core test`
