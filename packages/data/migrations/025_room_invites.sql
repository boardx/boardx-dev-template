-- 025_room_invites.sql — CAP-AUTH：房间邀请未注册邮箱（room_invites，p20 F09）
-- 与 team_invites 同一思路，但按邮箱幂等（同一房间同一邮箱只保留一条 pending 记录，
-- 重复邀请刷新 token/expires_at 而不是插入新行）；status 显式建模方便 pending 列表/撤销/过期展示。

CREATE TABLE IF NOT EXISTS room_invites (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,
  room_id       bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'member',
  token         text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending',   -- pending | accepted | revoked | expired
  invited_by    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, email)
);

CREATE INDEX IF NOT EXISTS idx_room_invites_email ON room_invites(email);
CREATE INDEX IF NOT EXISTS idx_room_invites_token ON room_invites(token);
