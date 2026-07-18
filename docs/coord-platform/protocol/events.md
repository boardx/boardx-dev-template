# Events + Andon 原语 v0.1 — 事件流与停线信号 wire format

> 三原语之三。events 是协调事件的**唯一可信历史**（append-only，语义继承 ADR-009
> 的 events 表）；andon 是其中一类特权事件，投影为阻断性 commit status。

## Event 信封（所有事件统一结构）

```json
{
  "protocol": "coord/0.1",
  "event_id": "evt_01J...",
  "type": "lease.claimed",
  "repo": "boardx/boardx-dev-template",
  "resource_id": "issue:698",
  "agent_id": "wrk-coord-1",
  "at": "2026-07-18T03:00:00Z",
  "payload": {}
}
```

- append-only：任何实现**禁止**对事件暴露 UPDATE/DELETE。
- `event_id` 单仓内严格递增可排序（ULID）；消费者以此做断点续传。

## 事件类型（v0.1 封闭集合，扩展走 CHANGELOG）

| type | payload 要点 | 旧 D1 events 对应 |
|---|---|---|
| `lease.claimed` | ttl_seconds | claim |
| `lease.heartbeat` | — | heartbeat |
| `lease.released` | handoff_note | release |
| `lease.expired` | last_heartbeat_at, handoff_note(服务端生成) | expire |
| `evidence.submitted` | manifest_id, head_sha | （新增） |
| `evidence.verdict` | verdict_id, verified | verdict |
| `review.verdict` | pr, reviewer_kind, verdict ok/changes | verdict |
| `merge.completed` | pr, sha | merge |
| `andon.raised` | scope, reason | （新增） |
| `andon.cleared` | scope, reason | （新增） |
| `mirror.updated` | kind issue/pr, number, fields_changed | （新增，镜像增量信号） |
| `task.dispatched` | task_id, assignee, priority, deadline, note | task-dispatch（0.1.1 起） |
| `task.acked` | task_id | task-ack（0.1.1 起） |
| `task.completed` | task_id | task-done（0.1.1 起） |
| `task.recalled` | task_id | task-recall（0.1.1 起） |

## 订阅

- 拉：`GET /v1/repos/{owner}/{repo}/events?since=<event_id>`（分页）。
- 推：WebSocket `wss://.../v1/repos/{owner}/{repo}/stream`，连接后先补发
  `since` 之后的积压再进入实时；断线重连用最后收到的 `event_id` 续传。

## Andon（特权事件，停线信号）

```json
{
  "protocol": "coord/0.1",
  "type": "andon.raised",
  "payload": {
    "scope": "repo",
    "reason": "main 上 init.sh 基础验证挂了，全体停止合并（issue #NNN）",
    "severity": "stop-merge"
  }
}
```

- **权限**：仅 maintainer 级身份（coordinator 层）可发；普通 worker 发 → 403。
  防伪造语义继承 coord-service 的 andon 设计。
- `scope` ∈ `repo | module:<name>`；`severity` v0.1 仅 `stop-merge`。
- **投影**：andon.raised(repo) → 所有 open PR 的 commit status `coord/andon` 置
  failure（若该 status 被设为 required，即物理阻断合并）；andon.cleared → success。
- ⚠️ **禁止把 `coord/andon` 配置为 required status check**。`coord/andon` 是
  **条件投递**的 status——仅在停线（andon active）或刚解除时投递到**当时 open
  的 PR** 上；此后新建的 PR 上不会出现它，andon 从未触发过时全仓 PR 都没有该
  status（见 `apps/coord-gateway/src/projection.ts` 的「无新事件且未停线：
  无事可投」逻辑）。而 required 语义要求该 check 在**每个** PR 上出现并转绿；
  `coord/andon` 无基线绿，设为 required 会让所有新建 PR 因该 check 永久
  pending 而无法合并（锁死全仓）。另外 commit status 是 sha 上的持久记录，
  GitHub 不会自动清除——曾经历停线的老 PR 若在 cleared 前未再更新，可能残留
  stale failure，设 required 会连这批老 PR 一起卡死。上一条里的「物理阻断
  合并」指的是 andon **触发时**已投递到 PR 上的 failure status 会阻断该 PR
  的合并，**不是**要你把它设为 required。
- `reason` 必填且必须含可查证的锚点（issue/事件链接）——停线要能被追责与复盘。

## Tasks（coord/0.1.1：派工收件箱事件）

tasks 收件箱（语义等价 coord-service `0002_tasks.sql`，#614）迁入 RepoHub DO 后，
每个状态迁移 emit 对应事件，`resource_id` 为 `issue:<n>`：

- `task.dispatched`：派工（admin 面，coordinator 特权）。payload 必含
  `task_id`（int ≥1）、`assignee`（非空）、`priority`（`high|normal|low`）；
  `deadline`/`note` 可为 null。`agent_id` = 派工方（broker 身份或 "admin"）。
- `task.acked` / `task.completed`：assignee 认领/交付（scoped 面，agent_id 强绑定，
  只能动自己的收件箱）。payload 必含 `task_id`。
- `task.recalled`：coordinator 撤回（admin 面）。payload 必含 `task_id`。
- 状态机：`pending → acked → done`；`pending|acked → recalled`；`pending → done`
  允许（跳过 ack 直接交付，D1 现行为）。非法迁移 409，不产生事件。
- **存量导入不产事件**：D1 → DO 的割接导入（`/tasks/import`，admin 面，幂等
  INSERT OR IGNORE 保留原 id）是审计回填，不是活跃协调信号；历史事件留存于
  D1 归档（F10 割接产物）。
