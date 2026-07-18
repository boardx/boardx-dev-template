# ADR 0001: 采用 ADR 记录架构决策

- 状态: Accepted
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-06-29

## 背景
大型、分阶段、由 agent 参与的开发需要可追溯的决策记录,且 agent 能读到。

## 决策
重大架构选择以 ADR 形式存放于 `docs/adr/`,用 `.harness/templates/adr.template.md` 生成,
并在 `.harness/instructions/architecture.md` 中链接相关 ADR。

## 后果
- 决策与代码同仓库,成为 agent 上下文的一部分(仓库即事实来源)。
- 新增编号顺延;被取代的标记 Superseded 并指向新 ADR。
