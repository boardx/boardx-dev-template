-- 0002_tasks.sql — 平台中立派工原语（issue #594，人类拍板 2026-07-12）。
-- 背景：session message 只有 Claude Code 会话能收，GitHub label 靠缘分轮询——
-- 派送机制不得依赖任何单一 agent runtime 的私有通道。tasks 表 = agent 收件箱：
-- coordinator POST 派工，assignee 轮询 GET + ack，纯 HTTP + bearer token，
-- 任何 runtime（CC/Codex/裸脚本）都能接。
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  issue       INTEGER NOT NULL,                       -- GitHub issue 号（任务规格所在）
  assignee    TEXT NOT NULL REFERENCES agents(id),
  priority    TEXT NOT NULL DEFAULT 'normal',         -- 'high' | 'normal' | 'low'（提示性，不参与逻辑）
  deadline    TEXT,                                   -- ISO 时间，可选
  note        TEXT,                                   -- 派工附言，可选
  status      TEXT NOT NULL DEFAULT 'pending',        -- pending → acked → done；coordinator 可 recalled
  created_by  TEXT NOT NULL REFERENCES agents(id),    -- 派工的 coordinator
  created_at  TEXT NOT NULL,
  acked_at    TEXT,
  updated_at  TEXT NOT NULL
);

-- 收件箱查询就是这一个访问模式：WHERE assignee = ? AND status = ?
CREATE INDEX idx_tasks_assignee_status ON tasks(assignee, status);
