// PlatformDirectory DO 的 SQLite schema。幂等（IF NOT EXISTS），DO 构造时执行。
// 领域模型权威：phases/phase-p30-devportal-platform/requirements/platform-redesign.md §1 + D6。
// 主键全部为不可变 ULID（改名不断链）；业务唯一性靠 UNIQUE 索引 + DO 单线程双保险，
// 禁止 SELECT-then-INSERT 判冲突（coord-repohub 同款纪律）。
export const SCHEMA = `
-- Project：GitHub App 安装 = 项目注册（多项目租户的根实体）
CREATE TABLE IF NOT EXISTS projects (
  project_id  TEXT PRIMARY KEY,              -- prj_<ULID>，不可变
  slug        TEXT NOT NULL,                 -- URL 安全标识（/projects/:slug），全局唯一
  name        TEXT NOT NULL,
  visibility  TEXT NOT NULL,                 -- public | private
  modules     TEXT NOT NULL,                 -- JSON array：模块划分
  sla         TEXT NOT NULL,                 -- JSON object：SLA 约定（审批时限等）
  gate_policy TEXT NOT NULL,                 -- JSON object：门禁策略（agent 准入 auto|manual 等，D2）
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_slug ON projects(slug);

-- Engineer：跨项目一等公民；@handle 全局唯一（platform-redesign §1）
CREATE TABLE IF NOT EXISTS engineers (
  engineer_id  TEXT PRIMARY KEY,             -- eng_<ULID>，不可变
  handle       TEXT NOT NULL,                -- 不含 @ 前缀存储；全局唯一
  display_name TEXT NOT NULL,
  github_login TEXT,                         -- GitHub 永远是权威：身份锚点（可空=未绑定）
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_engineers_handle ON engineers(handle);

-- Membership：engineer×project；角色 owner/maintainer/approver/contributor；
-- 状态机 pending→active→suspended（suspended→active 可复职），非法迁移 409
CREATE TABLE IF NOT EXISTS memberships (
  membership_id TEXT PRIMARY KEY,            -- mem_<ULID>，不可变
  project_id    TEXT NOT NULL,
  engineer_id   TEXT NOT NULL,
  role          TEXT NOT NULL,               -- owner | maintainer | approver | contributor
  status        TEXT NOT NULL,               -- pending | active | suspended
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_pair ON memberships(project_id, engineer_id);
CREATE INDEX IF NOT EXISTS idx_memberships_engineer ON memberships(engineer_id);

-- Agent：可管理的资产 + 有档案的工作者。owner 必填（问责锚点，👤/🤖 严格区分）；
-- parent 可空（sub-agent 用点号延伸命名，D6：@handle/agent-name，owner 命名空间唯一）
CREATE TABLE IF NOT EXISTS agents (
  agent_id          TEXT PRIMARY KEY,        -- agt_<ULID>，不可变（改名不断链）
  name              TEXT NOT NULL,           -- owner 命名空间内唯一；sub 形如 parent.name + ".<seg>"
  owner_engineer_id TEXT NOT NULL,           -- owner 必填：任何 agent 都属于一个人类
  parent_agent_id   TEXT,                    -- 可空；sub-agent 沿 parent 链追溯（锚 ULID）
  capabilities      TEXT NOT NULL,           -- JSON array：能力标签
  last_heartbeat_at TEXT,                    -- 心跳时间戳（enroll 后等首个心跳点亮，M2）
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_agents_owner_name ON agents(owner_engineer_id, name);
CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_agent_id);

-- Enrollment：agent×project 授权 + scoped token 引用（token 本体在对应仓的
-- RepoHub DO agent_tokens 表，这里只存前缀引用，绝不存明文/完整 hash）
CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id TEXT PRIMARY KEY,            -- enr_<ULID>，不可变
  agent_id      TEXT NOT NULL,
  project_id    TEXT NOT NULL,
  token_ref     TEXT,                        -- scoped token 引用（token_hash_prefix），可空=未发 token；
                                              -- 格式由 directory.ts TOKEN_REF_RE 强制校验（#770 跟进 2/3）
  status        TEXT NOT NULL,               -- active | revoked
  created_at    TEXT NOT NULL,
  revoked_at    TEXT                         -- status=revoked 时必有
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_pair ON enrollments(agent_id, project_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_project ON enrollments(project_id);

-- 审计事件：append-only（应用层绝不暴露 UPDATE/DELETE），复用 coord-protocol
-- 统一事件信封语义（directory.* 九类型，coord/0.1.2）
CREATE TABLE IF NOT EXISTS events (
  event_id    TEXT PRIMARY KEY,              -- evt_<ULID>，严格递增
  type        TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  agent_id    TEXT NOT NULL,                 -- ⚠️ 不可信自报提示，非鉴权主体：admin 面自报 actor，
                                              -- 缺省 "admin"，服务端零校验（#770 跟进 1/3，见 directory.ts actorOf）
  at          TEXT NOT NULL,
  payload     TEXT NOT NULL                  -- JSON
);
`;
