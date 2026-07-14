-- 036_team_memories.sql — 团队 Memory（04-F13，uc-team-009）
-- 团队在 AI 协作中可复用的上下文信息条目；按 (team_id, content) 文本去重。

CREATE TABLE IF NOT EXISTS team_memories (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id    bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_by bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, content)
);
CREATE INDEX IF NOT EXISTS idx_team_memories_team ON team_memories(team_id, content);
