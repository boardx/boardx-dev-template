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

> 下方「智能体编排架构」是 CAP-AI 的**规划态**（apps/orchestrator / packages/agent-core / tools 尚未建），
> 待 p9 AVA 阶段落地。当前 `packages/memory` 已存在（三层+wikilink），演进为 Personal Ontology。

## 平面划分（CAP-AI 规划态，未建）
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
- `docs/adr/0001-record-architecture-decisions.md` — 采用 ADR 实践。
- `docs/adr/0002-board-keyed-items.md` — 画布 item 从 room-keyed 演进为 board-keyed（加法过渡）。
