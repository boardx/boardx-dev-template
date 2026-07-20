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

> 下方「智能体编排架构」已从规划态落地：`packages/agent-core`/`tools`/`memory`
> 均已建（不再是"未建"，2026-07-20 更正此前的过期说明）。**编排引擎**这一层
> 2026-07-20 起改用 LangGraph（ADR-020），见「Agent 编排引擎」一节——它不是
> 新平面，是给下面这几个平面之间接线的方式。

## 平面划分（CAP-AI，已建）
- `packages/agent-core`:智能体内核——推理循环(plan→act→observe)、会话与回合管理。
- `packages/tools`:工具子系统,按最小权限暴露能力(shell、检索、外部 API 适配)。
- `packages/memory`:状态与记忆——短期工作记忆、长期持久化、跨会话恢复。
- `packages/ai`:provider 网关(anthropic/qwen 可插拔) + 编排入口(`graph.ts`)。

## Agent 编排引擎：LangGraph（ADR-020，2026-07-20 起）

`packages/ai/src/graph.ts` 此前是手写的"单节点聊天壳"（自述"不是 LangGraph，
也没有图结构"）——多步 agent 功能（如 Deep Research）靠在数据模型里假装有阶段、
实际一次性生成来模拟多步。**改用 LangGraph.js 的 `StateGraph`** 编排这一层：
节点=一次模型/工具调用，边=下一步去哪，checkpointer=状态持久化到 PG（与
`ontology_actions`/业务表同一实例，不引入第二个状态存储）。`interrupt_before`/
`interrupt_after` 原生支持"某阶段生成完、等人工确认再继续"，不必再靠手写状态
字段模拟这条约束。完整评估、迁移范围、为什么不是别的框架，见 ADR-020。

**边界（容易混淆，务必分清）**：LangGraph 编排的是**产品内一次 AI 请求的多步
执行**（这里说的一切），跟 harness 的 **coord-gateway/RepoHub DO**（协调多个
独立开发者 agent 会话——认领 feature、分派、合并 PR，见
`multi-agent-coordination.md`/`coordinator-sop.md`）是完全不同的两层，运行时长
（秒级 vs 小时/天级）、状态载体、参与者都不同，不要互相模拟或替代。

首个迁移目标：AVA Deep Research（p18-F03/F04）。仅覆盖 `apps/web`
（`runtime = "nodejs"`）；`apps/devportal` 是 Cloudflare edge runtime 且没有
产品级多步 agent 功能，不引入 LangGraph。

## 数据流(高层)
任务 → LangGraph 图规划节点 → agent-core 推理循环节点 → 经 tools 执行动作 →
observation 回灌图 state → checkpointer 落 memory/PG → 直到达成验证标准或
`interrupt` 等待人工 → 汇总交付。

## 不变量(实现必须遵守)
- 工具调用最小权限,默认拒绝;新增能力需在 `agentic-patterns.md` 登记。
- 任何跨会话状态都落 `memory`（或 LangGraph checkpointer，同落 PG）,不依赖
  进程内内存。
- 推理循环每一步可观测(见 `observability.md`),便于事后归因。

## 组织本体 / 知识图谱数据架构
2026-07-15 拍板规格的仓内权威 → `.harness/instructions/project/knowledge-ontology.md`
（项目专属事实，见 `project/boardx.md` 同一归口，不随模板抽取——模板只带方法论骨架）
（PG canonical 四表 + pgvector + AGE 可重建投影；graph-first；ontology_actions 唯一写入口）。

## 与 ADR 的关系
重大架构选择(编排模型、记忆后端、工具协议等)必须落 `docs/adr/`,并在此处链接。
- `docs/adr/0001-record-architecture-decisions.md` — 采用 ADR 实践。
- `docs/adr/0002-board-keyed-items.md` — 画布 item 从 room-keyed 演进为 board-keyed（加法过渡）。
- `docs/adr/ADR-020-agent-orchestration-langgraph.md` — 产品内多步 agent 流程改用 LangGraph。
