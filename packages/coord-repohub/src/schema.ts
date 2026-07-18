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

-- andon 停线状态（F06）：按 scope 一行当前态；历史全在 events（append-only），
-- 本表只是"现在停没停"的快照，供投影每 tick 对账。
CREATE TABLE IF NOT EXISTS andon_state (
  scope      TEXT PRIMARY KEY,               -- repo | module:<name>
  active     INTEGER NOT NULL,               -- 0/1
  severity   TEXT NOT NULL,                  -- v0.1 仅 stop-merge
  reason     TEXT NOT NULL,
  raised_by  TEXT NOT NULL,
  raised_at  TEXT NOT NULL,
  cleared_at TEXT                            -- active=0 时必有
);

-- 反向投影游标（F06）：投影消费 events 的断点，key 预留多投影器扩展
CREATE TABLE IF NOT EXISTS projector_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- evidence manifest 原文存档（F07）：manifest 是"完成声明"留痕对象（evidence.md），
-- 原文全量保存，评审/复核端按 resource_id 检索；append 语义，不暴露 UPDATE/DELETE
CREATE TABLE IF NOT EXISTS evidence_manifests (
  manifest_id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  head_sha    TEXT NOT NULL,                 -- 声明锚定 commit（P23 postmortem 铁律）
  body        TEXT NOT NULL,                 -- manifest 原文 JSON
  at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_resource
  ON evidence_manifests(resource_id);

-- 按仓 scoped agent token（F08）：只存 sha256 hex，绝不存明文。
-- token 明文只在 mint 响应里出现一次；verify 每次实时查本表（吊销即时生效，无缓存）。
-- "按仓 scope"天然成立：token 只在其所属仓的 DO 里有记录，跨仓 verify 查无 → 拒绝。
CREATE TABLE IF NOT EXISTS agent_tokens (
  token_hash TEXT PRIMARY KEY,               -- sha256(明文) hex，唯一存储形态
  owner      TEXT NOT NULL,                  -- 领取人（问责锚点，ADR-011）
  agent_id   TEXT NOT NULL,                  -- token 代表的 agent 身份
  created_at TEXT NOT NULL,
  revoked_at TEXT                            -- 非 NULL = 已吊销（不删行，留审计）
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
