# AGENTS.md — Phase p27 (aiStore) 局部指令

> 阶段级 scoped 指令,补充根 AGENTS.md。只写本阶段特有的约束。

## 本阶段焦点
梳理并迁移现有 AI Store 能力，强制 Agent/Skill/Template 按 Team 归属与隔离，将 AI Tool 与 Image Tool 统一为 Skills。

## 本阶段不变量
- Agent、Skill、Template 每条资源必须有不可为空的来源 Team。
- `scope` 只表达可见性，不能替代 Team 归属。
- 当前 Team 必须来自可信会话上下文；跨 Team 管理、订阅和执行必须被拒绝。

## 权威来源
- 功能清单:本目录 `feature_list.json`(本阶段唯一权威)。
- 进度:本目录 `progress.md`。

## GitHub 投影

- 本阶段唯一总追踪 Issue 是 [#662](https://github.com/boardx/boardx-dev-template/issues/662)。
- 所有 Feature Issue 必须回链 `Parent: #662`。
- 禁止创建第二个 AI Store 总追踪 Issue。

## 规则继承
根 `AGENTS.md` 的所有硬约束在此继续生效(尤其"完成定义"与"干净收尾")。
