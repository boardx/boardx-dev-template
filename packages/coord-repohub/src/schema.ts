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

-- WS 一次性 ticket（F09）：浏览器 WebSocket 无法带 Authorization header，
-- 由 gateway 用 bearer 换 60s 一次性 ticket；查到即销（一次性），过期即废。
-- 绝不把长期 token 下发到浏览器——这张表是唯一的替代凭据存放点。
CREATE TABLE IF NOT EXISTS stream_tickets (
  ticket     TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

-- tasks 收件箱（F10 前置）：字段语义等价 coord-service migrations/0002_tasks.sql（#614）。
-- coordinator 经 admin 面派工，assignee 轮询 GET + ack，纯 HTTP + bearer token。
-- 与 D1 版的差异：assignee/created_by 不再 REFERENCES agents(id)——DO 无 agents 表，
-- 派工资格与 assignee 在册校验上移到调用方（devportal broker 对 registry.yaml 校验）。
-- id 保留 AUTOINCREMENT：割接导入显式 id 后 sqlite_sequence 自动推进，新派工不撞号。
CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  issue       INTEGER NOT NULL,                -- GitHub issue 号（任务规格所在）
  assignee    TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal',  -- 'high' | 'normal' | 'low'（提示性，不参与逻辑）
  deadline    TEXT,                            -- ISO 时间，可选
  note        TEXT,                            -- 派工附言，可选（≤2000）
  status      TEXT NOT NULL DEFAULT 'pending', -- pending → acked → done；coordinator 可 recalled
  created_by  TEXT NOT NULL,                   -- 派工方（broker 身份 / "admin"）
  created_at  TEXT NOT NULL,
  acked_at    TEXT,
  updated_at  TEXT NOT NULL
);
-- 收件箱查询就是这一个访问模式：WHERE assignee = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee, status);

-- ========== 工作区分片三表（p30/F04）：需求流水线 / sprint 面板 / talk 对话流 ==========
-- 三类工作区数据迁入本 DO 后按仓天然分片：一个项目命名空间的 DO 里根本没有
-- 另一个项目的行，隔离由存储位置保证（同 agent_tokens 的按仓 scope 论证）。

-- 需求流水线条目：五态 submitted → analyzing → in_review → dispatched，
-- rejected 为审核拒绝终态（提交→分析→审核→下发，coord/0.1.3）
CREATE TABLE IF NOT EXISTS requirements (
  id           TEXT PRIMARY KEY,             -- req_<ULID>，时间序
  title        TEXT NOT NULL,                -- ≤300
  body         TEXT NOT NULL,                -- 原始需求正文，≤10000
  status       TEXT NOT NULL,                -- submitted|analyzing|in_review|dispatched|rejected
  submitted_by TEXT NOT NULL,                -- scoped 面强绑定的 agent_id
  analysis     TEXT,                         -- 分析阶段产出（advance 时可附）
  review_note  TEXT,                         -- 审核意见（review 时可附）
  reviewed_by  TEXT,                         -- 审核人（admin 面自报，缺省 "admin"）
  issue        INTEGER,                      -- 下发后关联的 GitHub issue 号
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);

-- sprint 面板条目：面板是派生视图的落库形态（写面 = admin/broker），
-- 关键字段拉平便于过滤，全量 JSON 保真（沿 mirror_items 模式）
CREATE TABLE IF NOT EXISTS sprint_items (
  sprint     TEXT NOT NULL,                  -- sprint 标识，如 "p30/01"
  item_id    TEXT NOT NULL,                  -- 条目 id（feature id / issue 号等）
  title      TEXT NOT NULL,
  status     TEXT NOT NULL,                  -- 面板列（not_started|in_progress|…，透传不枚举）
  assignee   TEXT,
  data       TEXT NOT NULL,                  -- 全量 JSON
  updated_at TEXT NOT NULL,
  PRIMARY KEY (sprint, item_id)
);

-- talk 对话流：append-only（无编辑/删除面），message_id 为 ULID 时间序，
-- since 续传语义同 events
CREATE TABLE IF NOT EXISTS talk_messages (
  message_id  TEXT PRIMARY KEY,              -- tlk_<ULID>
  author      TEXT NOT NULL,                 -- scoped 面强绑定的 agent_id
  body        TEXT NOT NULL,                 -- ≤4000
  needs_human INTEGER NOT NULL DEFAULT 0,    -- 0/1：待人类拍板标记
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
