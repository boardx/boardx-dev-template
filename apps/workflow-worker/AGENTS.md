# AGENTS.md — apps/workflow-worker 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
BullMQ worker 进程：消费 `boardx.jobs`，处理后把状态回写 Postgres。CAP-WORKFLOW。

## 局部约束
- 处理逻辑拆成纯函数（如 `decideStatus`）与 IO 边界分离，纯函数可单测。
- **幂等**：同一 job 重复投递不产生不一致状态。
- DB 回写走 `@repo/data`；队列消费走 `@repo/queue`，不深路径 import。
- 验证见 `.harness/instructions/testing-standards.md` 的「CAP-WORKFLOW」段（异步轮询，别假设瞬时完成）。
