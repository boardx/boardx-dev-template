-- 016_kb_files.sql — CAP-FILE 知识库文件（p10-F01 地基）
-- scope: personal | team | agent | tool；owner_user_id 恒记录上传者，
-- team scope 额外记 team_id 做团队级隔离。status 由上传/处理管线单向推进
-- （uploading → processing → ready，失败态 error），worker 异步回写，不由前端直接改。

CREATE TABLE IF NOT EXISTS kb_files (
  id             text PRIMARY KEY,
  scope          text NOT NULL DEFAULT 'personal', -- personal | team | agent | tool
  owner_user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id        bigint REFERENCES teams(id) ON DELETE CASCADE,
  name           text NOT NULL,
  ext            text NOT NULL,
  mime_type      text NOT NULL,
  size_bytes     bigint NOT NULL,
  object_key     text NOT NULL,             -- 对象存储 key（CAP-FILE，见 @repo/storage）
  status         text NOT NULL DEFAULT 'processing', -- processing | ready | error
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_files_scope_owner_idx ON kb_files (scope, owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS kb_files_team_idx ON kb_files (team_id) WHERE team_id IS NOT NULL;
