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
  **条件投递**的 status——仅在停线（andon active）或刚解除时才会出现在 PR 上，
  平时任何 PR 上都没有它（见 `apps/coord-gateway/src/projection.ts` 的
  「无新事件且未停线：无事可投」逻辑）。而 required 语义要求该 check 在**每个**
  PR 上出现并转绿；`coord/andon` 无基线绿，设为 required 会让全仓所有 PR 因该
  check 永久 pending 而无法合并（锁死全仓）。上一条里的「物理阻断合并」指的是
  andon **触发时**已投递到 PR 上的 failure status 会阻断该 PR 的合并，**不是**
  要你把它设为 required。
- `reason` 必填且必须含可查证的锚点（issue/事件链接）——停线要能被追责与复盘。
