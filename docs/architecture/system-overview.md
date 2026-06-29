# 系统总览

本仓库构建一个 agentic 系统,采用三平面组织(见根 README)。本文件是给**人**读的高层视图;
给 **agent** 的可执行约束在 `.harness/instructions/architecture.md`。

## 代码平面拓扑
- `apps/orchestrator` 依赖 `packages/agent-core`、`packages/tools`、`packages/memory`。
- 包间通过公开导出通信,turbo 负责构建编排与缓存。

## 交付与控制
- 开发按 `phases/`(阶段=项目)推进,每阶段若干 sprint。
- harness 控制平面 `.harness/` 负责生成 phase/sprint、门控验证、单向同步 GitHub。
