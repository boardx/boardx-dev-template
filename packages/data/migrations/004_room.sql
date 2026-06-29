-- 004_room.sql — CAP-COLLAB 房间：rooms / room_members
-- Room = BoardX 核心协作空间（Workspace）。visibility: private | team。

CREATE TABLE IF NOT EXISTS rooms (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id       bigint REFERENCES teams(id) ON DELETE SET NULL,   -- 可归属团队，或个人(NULL)
  visibility    text NOT NULL DEFAULT 'private',                  -- private | team
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_team ON rooms(team_id);

CREATE TABLE IF NOT EXISTS room_members (
  room_id    bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
