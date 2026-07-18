# ADR-018: Harness V2 产品边界与核心协议

- 状态: Accepted（人类要求建立 `main_V2` 并按长期 Harness 架构重构，2026-07-18）
- 日期: 2026-07-18
- 关联: ADR-009（协调权威）、ADR-012（审计链）、ADR-017（coord-platform）、
  Phase p29（协调层）、Phase p30（Harness V2）

## 背景

仓库已经形成三组能力：

1. `AGENTS.md`、Skills、worktree、shell 和门禁组成的 repository-native 开发环境。
2. p29 coord-platform 提供的跨 Agent 租约、任务派送、RepoHub、GitHub 投影和开放接入。
3. `agent-core`、`orchestrator`、`tools`、`memory` 组成的早期执行骨架。

第三组目前把验收 shell 命令当作 Agent loop，Session 只在进程内积累步骤，结束时把摘要
写入 JSON。它没有版本化的 Task/Run 协议、append-only Run 事件、checkpoint 恢复、
Evaluation 或 commit Attestation。与此同时，现有 `verify.ts` 同时执行命令、写证据、
修改 Feature 状态并刷新派生视图。

如果继续在这些实现上直接增加模型、调度和评估能力，运行时状态、协调状态、Git 状态和
GitHub 投影会继续互相双写。长期结果将是每次修改都要触发完整治理链，且任一组件升级都
可能改变其它平面的语义。

## 决策

### D1. Harness V2 采用小内核、持久运行时和独立控制平面

V2 分为七层：

| 层 | 职责 | 权威 |
|---|---|---|
| Core Protocol | Task/Run/Step/Event/Artifact/Evaluation/Attestation schema | 版本化协议 |
| Runtime | Agent loop、event append、checkpoint、retry/resume/cancel | Run event store |
| Workspace | worktree/sandbox 生命周期、权限、缓存 | Workspace provider |
| Tool/Model Adapters | 模型、工具和 Agent 供应商适配 | Adapter contract |
| Eval Plane | 验证计划、执行、Artifact、Attestation | Eval store |
| Control Plane | dispatch、claim、lease、review policy | p29 coord-platform |
| Delivery Adapters | Feature、PR、Issue、CI 和 GitHub 投影 | Git + GitHub |

Core 不依赖 GitHub、Cloudflare、Codex、Claude、OpenAI 或具体数据库。

### D2. 五个概念不得合并

```
Feature != Task != Run != Pull Request != Evaluation
```

- Feature 是版本化业务交付契约。
- Task 是一次工作请求。
- Run 是 Task 的一次执行尝试。
- Pull Request 是 Delivery Adapter 中的交付载体。
- Evaluation 是对精确 Feature revision 和 commit 的验证结果。

一个 Feature revision 最终仍只能由一个 Delivery PR 交付，但它可以产生多个 Task、
Run 和 Evaluation。

### D3. append-only RunEvent 是执行事实源

Runtime 的状态变化必须记录为带 `run_id`、`task_id`、单调 `sequence`、
`idempotency_key` 和协议版本的 RunEvent。Step 是事件投影，不是独立权威。

F01 只冻结事件 wire contract；event store、reducer 和 checkpoint 在 p30 F02 实现。
首版不引入 Graph DSL。未来需要图编排时，它作为 Runtime 上层 API，不改变事件事实源。

### D4. Attestation 不可变，当前交付状态可派生

不可变证明必须锚定：

- Feature id 和 revision
- 精确 commit SHA
- Environment digest
- Verifier name 和 version
- 内容寻址 Artifact

历史 Attestation 不回写。新 commit 产生后，旧证明仍真实但对当前 HEAD 变为 stale；
因此不再把一个全局且不可逆的 `passing` 字段当作所有时间点的验证真相。现有 passing
语义在迁移期继续保留，由 p30 F05/F07 通过兼容投影逐步替换。

### D5. p29 coord-platform 不被 Harness Runtime 重写

p29 继续拥有跨 Agent 的 task dispatch、claim、lease、身份和 GitHub 实时投影。
Harness Runtime 拥有 Run/Step/checkpoint 执行事实。两个平面通过 adapter 协作，不把
Harness Run 事件塞进现有 `coord/0.1` wire format，也不再建立第二套租约服务。

### D6. `@repo/harness-core` 是 V2 稳定入口

新增零运行时第三方依赖的 `@repo/harness-core`：

- 导出只读 TypeScript contracts。
- 为外部输入提供 runtime validation。
- 使用 `harness/2.0` 协议标识。
- breaking wire change 必须升级协议版本并提供迁移说明。

迁移期 `@repo/agent-core` re-export V2 core，同时保留 V1 `Task`、`AgentSession`、
`createSession` 和 `appendStep`。调用方按 Feature 逐步迁移，禁止一次性重写。

### D7. `main_V2` 是受控迁移基线

按人类要求，从最新 `main` 建立 `main_V2`。它是 V2 的阶段性集成目标，不是允许直接
堆提交的共享开发分支：

- 每个 p30 Feature 使用独立短命分支。
- 每个 Feature 只能有一个 Delivery PR，目标为 `main_V2`。
- Review 返工继续进入原 PR。
- `main` 在迁移期继续承载 V1。
- p30 全部交付、兼容性验证和迁移演练通过后，再由单独决策决定如何晋升或替换。

## 后果

正面：

- 模型、Runtime、协调层、Evaluation 和 GitHub 可以独立演进。
- Run 可以在后续 Feature 中实现 checkpoint 恢复，而不改变 Feature/PR 语义。
- 验证缓存可以按 commit、环境和 verifier 精确失效。
- p29 coord-platform 已有投入继续复用，不出现重复控制平面。

代价：

- V1/V2 并存期间需要兼容 facade 和双版本测试。
- `main_V2` 会产生与 `main` 的同步成本，必须保持迁移周期有限。
- Core 协议发布后 breaking change 成本提高，因此首版只冻结最小原语。

## 执行顺序

权威执行载体是 `phases/phase-p30-harness-v2/feature_list.json`：

1. F01 核心协议与产品边界。
2. F02 event-sourced Runtime 与 checkpoint。
3. F03 Workspace/Sandbox。
4. F04 Model/Tool/Agent adapters。
5. F05 Eval/Artifact/Attestation。
6. F06 coord-platform Control Plane 集成。
7. F07 V1 迁移、CLI 和可观测性收口。
