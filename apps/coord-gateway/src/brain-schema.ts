// CoordBrain DO 的 SQLite schema（R1 影子模式，p30-F10）。独立于 RepoHub 的 events
// 表——CoordBrain 只记录「它将会做的决策」（coord.shadow.* 命名空间），从不与
// RepoHub 的权威事件流（lease/andon/task 等真实状态变更）混淆。append-only，
// 应用层不暴露 UPDATE/DELETE（与 RepoHub events 同一纪律，events.md）。
export const BRAIN_SCHEMA = `
CREATE TABLE IF NOT EXISTS shadow_events (
  -- 真实排序键：AUTOINCREMENT 单调递增，绝不并列（"at" 截到秒级，同一秒内多条
  -- 决策若只按 at 排序会被 event_id 的随机 UUID 打乱因果序——seq 是唯一权威排序）。
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id   TEXT NOT NULL,
  tick_id    TEXT NOT NULL,          -- 同一次 tick 产出的多条决策共享同一批次 id
  rule       TEXT NOT NULL,          -- merge_ready | dispatch_suggested | pr_nudge | stale_lease_reclaim | andon_freeze
  subject_id TEXT NOT NULL,          -- "pr:123" / "issue:45" / "lease:lse_xxx" / "repo"
  decision   INTEGER NOT NULL,       -- 0/1："它将会做的动作"是否会触发
  reason     TEXT NOT NULL,
  detail     TEXT,                  -- JSON：输入快照要点（rule-id 与输入快照留痕，供人核对）
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shadow_at ON shadow_events(at);
CREATE INDEX IF NOT EXISTS idx_shadow_rule ON shadow_events(rule);
CREATE INDEX IF NOT EXISTS idx_shadow_tick ON shadow_events(tick_id);
`;
