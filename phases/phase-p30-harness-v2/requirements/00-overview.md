# 原始需求（概览）— Harness V2（Phase p30）

> 这是 `requirements/` 文件夹里的**起始模板**。需求多时按领域拆成多份
> （如 `auth.md`、`teams.md`、`rooms.md`），本文件可改名/删除。
>
> 流水线：**本文件夹的全部 *.md（原始需求）→ requirement-author 智能体 → feature_list.json（权威）**。
>
> 原始需求是「输入/上下文」，不是权威；权威永远是 `../feature_list.json`。
> 这里可以模糊、可以是用户故事；模糊之处由 requirement-author 提问澄清后再落成 feature。

## 背景 / 为什么做

当前仓库同时存在三类能力：

1. 基于 `AGENTS.md`、Skills、worktree 和 shell 的仓库开发环境。
2. p29 coord-platform 提供的租约、事件、GitHub 镜像和供应商中立接入面。
3. `agent-core`、`orchestrator`、`tools`、`memory` 的早期 Agent Runtime 骨架。

第三类仍把 Task、Session、验收 shell 命令和内存对象绑定在一起；运行中断不能按
checkpoint 恢复，Evaluation 也没有独立于 Feature 状态。继续往现有骨架叠功能会让
运行时、协调层和交付规则互相耦合。

## 原始需求

- 作为 Harness 集成者，我需要稳定、版本化、供应商中立的核心协议，避免绑定 Codex、
  Claude、GitHub 或某个模型 API。
- 作为 Agent Runtime，我需要把 Feature、Task、Run、Step、Artifact、Evaluation 和
  Attestation 分开建模，以便一次任务可以重试、恢复和被独立评估。
- 作为 Agent 操作者，我需要执行过程按事件持久化，并能从 checkpoint 恢复，而不是
  每次会话重启后从头读取和执行。
- 作为项目维护者，我需要快环验证与交付验证分层，并让验证证明锚定 commit、环境和
  verifier 版本。
- 作为现有 BoardX 开发者，我需要 V1 在迁移期继续工作；V2 通过兼容适配器逐步接管，
  不允许一次性重写。

## 验收线索

- 核心协议包没有运行时第三方依赖，类型和 runtime validation 同时存在。
- Run 事件可幂等追加，状态可以从事件重建，并能保存/恢复 checkpoint。
- Model、Tool、Workspace、Artifact Store 和 Control Plane 都通过接口适配。
- Evaluation 结果与 Feature 状态分离，Attestation 锚定精确 commit。
- 现有 `agent-core`、orchestrator 和 p29 coord-platform 在迁移期测试保持通过。

## 范围与边界

- 本阶段要做：核心协议、持久运行时、Workspace/Sandbox、provider adapters、
  Evaluation/Artifact、coord-platform 集成和 V1 渐进迁移。
- 明确不做：重写 p29 协调协议、在单个 PR 中完成全部迁移、引入特定模型供应商作为
  核心依赖、把 GitHub 状态当成 Run 权威。

## 已知约束 / 依赖

- p29 coord-platform 继续负责跨 Agent 协调、租约、RepoHub 和 GitHub 投影。
- Git 继续负责 Feature 规格与代码；Run event store 负责执行事实。
- 所有 wire format 必须带协议版本；破坏性变更通过新版本和迁移器发布。
- 每个 Feature 必须由一个独立 Delivery PR 交付。

## 切分提示

- 每个 Feature 必须能在一个独立 PR 中实现并验证。
- 先核心协议，再 durable runtime；先有事件和 checkpoint，再接模型 provider。
- Eval 与 coord-platform 集成在 Runtime 稳定后进行。
