// RepoHub DO 的 SQLite schema。幂等（IF NOT EXISTS），DO 构造时执行。
// 语义继承 coord-service/migrations/0001_init.sql：
// uq_active_lease 与 DO 单线程共同构成原子性双保险（禁止 SELECT-then-INSERT 判冲突）。
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS leases (
  lease_id          TEXT PRIMARY KEY,
  resource_id       TEXT NOT NULL,
  resource_type     TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  status            TEXT NOT NULL,          -- in_progress | released | expired
  claimed_at        TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  ttl_seconds       INTEGER NOT NULL,
  expires_at        TEXT NOT NULL,          -- ISO；由 claimed/heartbeat 推进
  handoff_note      TEXT                    -- released/expired 后必有
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_lease
  ON leases(resource_id) WHERE status = 'in_progress';
CREATE INDEX IF NOT EXISTS idx_leases_expiry
  ON leases(expires_at) WHERE status = 'in_progress';

-- append-only：应用层绝不暴露 UPDATE/DELETE（events.md）
CREATE TABLE IF NOT EXISTS events (
  event_id    TEXT PRIMARY KEY,             -- ULID，严格递增
  type        TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  at          TEXT NOT NULL,
  payload     TEXT NOT NULL                 -- JSON
);

-- webhook 幂等：delivery GUID 去重（F03——重复投递不产生重复事件）
CREATE TABLE IF NOT EXISTS deliveries (
  delivery_id TEXT PRIMARY KEY,
  at          TEXT NOT NULL
);

-- issue/PR 镜像：关键字段拉平便于过滤，全量 JSON 保真（F04）
CREATE TABLE IF NOT EXISTS mirror_items (
  kind        TEXT NOT NULL,                -- issue | pr
  number      INTEGER NOT NULL,
  state       TEXT NOT NULL,
  title       TEXT NOT NULL,
  head_sha    TEXT,                         -- pr only
  mergeable   TEXT,                         -- pr only: MERGEABLE | CONFLICTING | UNKNOWN
  merge_state TEXT,                         -- pr only: mergeStateStatus
  labels      TEXT NOT NULL,                -- JSON array
  assignees   TEXT NOT NULL,                -- JSON array
  data        TEXT NOT NULL,                -- 全量 JSON
  mirrored_at TEXT NOT NULL,                -- 镜像时间戳（响应必带，SHA/时点锚定）
  PRIMARY KEY (kind, number)
);
`;
