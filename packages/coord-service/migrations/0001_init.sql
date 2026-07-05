-- registry.yaml mirror; token_hash is the only field with no registry.yaml counterpart
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,       -- 'coord-architecture', 'wrk-ava-p18-1' ...
  kind        TEXT NOT NULL,          -- coordinator | module-coordinator | architecture-coordinator | worker | reviewer
  areas       TEXT,                   -- JSON array, mirrors registry.yaml `areas`
  token_hash  TEXT NOT NULL,          -- sha256(bearer token) hex digest — never store plaintext
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL
);

-- Claims table doubles as feature/resource leases AND coordinator-role singletons
-- (resource_id 'role:coord-main' etc.) — the uq_active_claim index below is what
-- makes both cases a real atomic lock instead of a GitHub-label race.
CREATE TABLE claims (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id       TEXT NOT NULL,     -- 'feature:p18/F03' | 'role:coord-main' | ...
  resource_type     TEXT NOT NULL,     -- 'feature' | 'coordinator-role' | ...
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  status            TEXT NOT NULL,     -- 'in_progress' | 'released' | 'expired'
  claimed_at        TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  ttl_seconds       INTEGER NOT NULL DEFAULT 21600,   -- 6h, matches today's LEASE_TTL convention
  released_at       TEXT
);

-- The whole atomicity guarantee lives in this one line: only one row per
-- resource_id may be 'in_progress' at a time. A claim attempt is a single
-- INSERT; a conflict here IS the "already claimed" answer, not a bug to guard
-- against with a SELECT-then-INSERT (see AGENTS.md — that pattern is banned).
CREATE UNIQUE INDEX uq_active_claim ON claims(resource_id) WHERE status = 'in_progress';

-- Append-only audit log. Application layer must never expose UPDATE/DELETE on
-- this table — it is the one true history of "what happened, when, to whom."
CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL,    -- claim | heartbeat | release | expire | verdict | merge
  resource_id TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  payload     TEXT,             -- JSON, free-form per event type
  at          TEXT NOT NULL
);

CREATE TABLE verdicts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_ref        TEXT NOT NULL,     -- 'github:357'
  reviewer_kind TEXT NOT NULL,     -- rev-code | rev-e2e | rev-feature | rev-security
  agent_id      TEXT NOT NULL,
  verdict       TEXT NOT NULL,     -- ok | changes
  notes         TEXT,
  at            TEXT NOT NULL
);

-- Small addition beyond the originally-approved four tables: a single-row-per-key
-- cursor store so the one-way GitHub projector (cron/projector.ts) can track "which
-- events id have I already projected" without re-scanning or re-posting on every run.
CREATE TABLE projector_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
