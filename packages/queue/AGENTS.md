# AGENTS.md — packages/queue 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
BullMQ 队列封装（连 Redis）。CAP-WORKFLOW。

## 局部约束
- **队列名集中常量**：所有队列名出自 `QUEUE_NAMES`，禁止 magic string。
- **任务必须幂等**：worker 可能重试，相同输入多次处理结果一致；副作用要可重入。
- 连接配置走 `resolveRedisConnection`（环境变量单一来源）；纯逻辑可单测、不连真实 Redis。
- 暂用 BullMQ + Redis；不引入 Temporal（见项目决策）。
