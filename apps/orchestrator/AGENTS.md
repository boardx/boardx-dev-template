# AGENTS.md — apps/orchestrator 局部指令

> 包级 scoped 指令(渐进披露第 2 层),补充根 AGENTS.md。

## 本包职责
智能体编排器:接收 Task,规划→调度 packages/* 能力→汇总。

## 局部约束
- 编排入口唯一;planner 与 executor 解耦(见 .harness/instructions/agentic-patterns.md)。
- 只通过各 package 的公开导出依赖,禁止深路径 import。
