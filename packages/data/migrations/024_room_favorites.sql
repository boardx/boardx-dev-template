-- 024_room_favorites.sql — CAP-DATA 收藏房间（P20 F05），每用户独立。
-- 取舍：与 009_board_favorites 保持同一模式——用独立表而非 room_members.favorite 列，
-- 因为收藏是纯粹的个人书签行为，不依赖/不影响成员角色（room_members 记录的是成员资格与角色），
-- 用独立表可以保持 room_members 语义单一，且收藏记录随用户或房间删除自然级联清理。
CREATE TABLE IF NOT EXISTS room_favorites (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id    bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);
CREATE INDEX IF NOT EXISTS idx_room_favorites_user ON room_favorites(user_id, created_at DESC);
