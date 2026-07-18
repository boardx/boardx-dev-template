# Lease 原语 v0.1 — 原子租约 wire format

> 三原语之一（Lease / Evidence / Events+Andon）。语义继承 ADR-009 的 D1 claims
> （`uq_active_claim`：同一 resource 任一时刻至多一个活跃持有者），载体换 RepoHub DO
> （ADR-017）。本文件是开放规格；参考实现与校验器在 `packages/coord-protocol`。

## 资源命名（resource_id）

```
feature:<phase>/<Fxx>     例 feature:p29/F02
issue:<number>            例 issue:698
role:<coordinator-id>     例 role:coord-main      （协调者唯一性单例）
module:<name>             例 module:devportal     （模块协调锁）
```

`resource_type` ∈ `feature | issue | coordinator-role | module | custom`。

## 消息

### ClaimRequest → POST /v1/repos/{owner}/{repo}/claims

```json
{
  "protocol": "coord/0.1",
  "resource_id": "issue:698",
  "resource_type": "issue",
  "agent_id": "wrk-coord-1",
  "ttl_seconds": 21600
}
```

- `ttl_seconds` 可省略，默认 21600（6h，沿用 LEASE_TTL 惯例）；上限 86400。
- 成功：**201** + `Lease`。冲突：**409** + `LeaseConflict`（含当前持有者与租约新鲜度，
  这是撞车防护的用户可见形态）。同 agent 对同资源重复 claim：200 幂等返回现有 Lease。

### Lease（服务端权威对象）

```json
{
  "protocol": "coord/0.1",
  "lease_id": "lse_01J...",
  "resource_id": "issue:698",
  "resource_type": "issue",
  "agent_id": "wrk-coord-1",
  "status": "in_progress",
  "claimed_at": "2026-07-18T03:00:00Z",
  "last_heartbeat_at": "2026-07-18T03:00:00Z",
  "ttl_seconds": 21600,
  "expires_at": "2026-07-18T09:00:00Z"
}
```

`status` ∈ `in_progress | released | expired`（终态二种不可逆）。

### Heartbeat → POST /v1/.../claims/{lease_id}/heartbeat

```json
{ "protocol": "coord/0.1", "agent_id": "wrk-coord-1" }
```

200 + 刷新后的 `Lease`。对非 `in_progress` 租约心跳 → 410 Gone（防僵尸续命）。

### Release → POST /v1/.../claims/{lease_id}/release

```json
{
  "protocol": "coord/0.1",
  "agent_id": "wrk-coord-1",
  "handoff_note": "F02 规格三份已落盘，coord-protocol 测试 12 通过；剩 CHANGELOG 未写。"
}
```

- **`handoff_note` 必填（≥10 字符）**：把 session-handoff 纪律结构化——没有交接就不能放手。
  缺失/过短 → 422。
- 过期回收（DO alarm 机械执行）产生的 `expired` 租约，其 handoff_note 由服务端置为
  `"[expired] last_heartbeat_at=<ts>"`，并发 `lease.expired` 事件供 coordinator 重派。

## 原子性保证（实现约束，非仅约定）

同一仓库的所有租约判定必须串行化在单一执行点（RepoHub DO 单线程），
**禁止 SELECT-then-INSERT**；冲突判定即插入冲突本身。跨仓租约互不可见。

## 与存量 D1 claims 的映射

| D1 字段 | v0.1 | 备注 |
|---|---|---|
| resource_id/resource_type/agent_id | 同名 | 语义不变 |
| status in_progress/released/expired | 同名 | 不变 |
| claimed_at/last_heartbeat_at/ttl_seconds | 同名 | 不变 |
| （无） | lease_id、expires_at、handoff_note、protocol | v0.1 新增 |
