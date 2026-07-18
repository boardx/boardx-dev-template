# 系统 agentic 架构总览

> 渐进式披露第 3 层。被构建系统(产品)本身是一个智能体系统;本文件描述它的运行时架构。
> 这是「代码平面」的设计契约,`apps/` 与 `packages/` 的实现必须与此一致。

## BoardX 产品数据模型（已建，权威，2026-06-30）

当前实际落地的全栈产品（`apps/web` + `packages/data`，显式 pg + SQL，不用 ORM）。
实体关系（均经 `packages/data/migrations/*.sql` 演进，仓储函数在 `packages/data/src/*.ts`）：

```
users ──< team_members >── teams
  │                          │
  └──< rooms (owner/team) ──< room_members
            │
            ├──< boards (room 内多个白板; visibility room|team|public)        [P5]
            │       ├──< board_items (画布内容; 见 ADR-0002 board-keyed 过渡)  [P6]
            │       ├──< board_favorites / board_visits                        [P5]
            │       └── settings jsonb (交互偏好)                              [P7]
            └──< room_chats (房间内 AVA 聊天线程; 消息体待 p9)                 [P4]
```

**数据层硬约定（实现必须遵守）**：
- **schema 只经 migrations 改**；app 不散写 SQL，统一走 `packages/data` 仓储函数。
- **pg `bigint`(int8) 返回值是字符串**，不是 number。跨类型比较（如 `chat.room_id !== Number(params.id)`）
  会恒真致 bug——比较前用 `Number()` 或 `String()` 统一。同为 bigint 的字段间 `===` 安全（都是字符串）。
- 权限判定优先走 SQL（`canViewRoom`/`canViewBoard`/`getBoardAccessRole` 等仓储函数），不在 app 层散判。
- 新增能力按 CAP 平面归类（CAP-WEB/DATA/AUTH/CANVAS/COLLAB/AI…），feature 带 `capability` 字段。

**API/UI 约定**：API 路由在 `apps/web/app/api/**/route.ts`（`currentUser()` 鉴权，401/403/404 语义一致）；
页面在 `apps/web/app/(app)/**`，必须实现 loading/empty/error 三态、禁原生 `<button>`（用 `@/components/ui/*`），
过 `apps/web/scripts/lint-design.sh` 门控（见 `uiux-standards.md`）。

## Harness 与智能体运行时

当前实现分为两个产品边界：

- p29 coord-platform：跨 Agent 协调层，负责 dispatch、claim、lease、身份和 GitHub 投影。
- p30 Harness V2：Agent 执行层，负责 Task、Run、Step、checkpoint、Workspace 和 Evaluation。

早期 `apps/orchestrator`、`packages/agent-core`、`packages/tools`、`packages/memory`
在迁移期继续工作；`packages/harness-core` 是 V2 协议入口。完整决策见 ADR-018。

### 权威边界

| 对象 | 权威 |
|---|---|
| Feature 规格和代码 | Git |
| Task dispatch、claim、lease | coord-platform |
| Run、Step、checkpoint | Harness Run event store |
| Evaluation、Artifact、Attestation | Eval Plane |
| Delivery PR、review、CI 投影 | GitHub |

Feature、Task、Run、Pull Request 和 Evaluation 不得合并为一个状态对象。

### 数据流

Feature → Control Plane 创建 Task → Runtime 创建 Run → Workspace/Tools 执行 →
RunEvent 持久化 → Evaluation 产出 Artifact/Attestation → Delivery Adapter 更新 PR。

### 不变量

- Core Protocol 不依赖模型供应商、GitHub、具体数据库或 sandbox 实现。
- RunEvent append-only，带协议版本、单调 sequence 和 idempotency key。
- 跨会话执行状态必须可 checkpoint 和恢复，不能只存在进程内存。
- 工具调用最小权限，默认拒绝；新增能力需在 `agentic-patterns.md` 登记。
- 每一步可观测，Evaluation 必须锚定 Feature revision、commit、环境和 verifier 版本。
- coord-platform 与 Harness Runtime 各自只有一个权威，不双写租约或 Run 状态。

## 与 ADR 的关系
重大架构选择(编排模型、记忆后端、工具协议等)必须落 `docs/adr/`,并在此处链接。
- `docs/adr/0001-record-architecture-decisions.md` — 采用 ADR 实践。
- `docs/adr/0002-board-keyed-items.md` — 画布 item 从 room-keyed 演进为 board-keyed（加法过渡）。
- `docs/adr/ADR-017-coord-repohub-do-rebuild.md` — coord-platform 产品边界。
- `docs/adr/ADR-018-harness-v2-product-boundary-and-core-contracts.md` — Harness V2 分层与核心协议。
