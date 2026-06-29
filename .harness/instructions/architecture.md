# 系统 agentic 架构总览

> 渐进式披露第 3 层。被构建系统(产品)本身是一个智能体系统;本文件描述它的运行时架构。
> 这是「代码平面」的设计契约,`apps/` 与 `packages/` 的实现必须与此一致。

## 平面划分
- `apps/orchestrator`:智能体编排器,负责接收任务、规划、调度子能力、汇总结果。
- `packages/agent-core`:智能体内核——推理循环(plan→act→observe)、会话与回合管理。
- `packages/tools`:工具子系统,按最小权限暴露能力(shell、检索、外部 API 适配)。
- `packages/memory`:状态与记忆——短期工作记忆、长期持久化、跨会话恢复。

## 数据流(高层)
任务 → orchestrator 规划 → agent-core 推理循环 → 经 tools 执行动作 →
observation 回灌 → memory 记录 → 直到达成验证标准 → 汇总交付。

## 不变量(实现必须遵守)
- 工具调用最小权限,默认拒绝;新增能力需在 `agentic-patterns.md` 登记。
- 任何跨会话状态都落 `memory`,不依赖进程内内存。
- 推理循环每一步可观测(见 `observability.md`),便于事后归因。

## 与 ADR 的关系
重大架构选择(编排模型、记忆后端、工具协议等)必须落 `docs/adr/`,并在此处链接。
