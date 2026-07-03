-- 022_retire_room_canvas.sql — CAP-DATA 下线 legacy 单画布模型（uc-rr-009 / p20-F10）
-- 005 时代「房间=单块画布」的 board_items 是 room-keyed（board_id IS NULL）。
-- 本迁移把这些 legacy 行回填到每房间自动创建的默认 board（"Main board"），
-- 然后给 board_id 加 NOT NULL 约束（此后唯一写路径 /api/boards/[id]/items 恒带 board_id）。
-- 幂等可重跑：重复执行时不重复建板、不重复回填、约束已存在则跳过。

-- 1) 为每个仍有 legacy items（board_id IS NULL）的房间建一块默认 board。
--    已有同名 "Main board" 的房间复用现有板，不重复创建（E1：无 legacy items 的房间不建空板）。
INSERT INTO boards (room_id, team_id, name, owner_user_id)
SELECT r.id, r.team_id, 'Main board', r.owner_user_id
FROM rooms r
WHERE EXISTS (
        SELECT 1 FROM board_items bi
        WHERE bi.room_id = r.id AND bi.board_id IS NULL
      )
  AND NOT EXISTS (
        SELECT 1 FROM boards b
        WHERE b.room_id = r.id AND b.name = 'Main board'
      );

-- 2) 把 legacy items 回填到所在房间的默认 board（同房多块 "Main board" 时取最早那块，确定性）。
UPDATE board_items bi
SET board_id = mb.board_id
FROM (
  SELECT DISTINCT ON (room_id) room_id, id AS board_id
  FROM boards
  WHERE name = 'Main board'
  ORDER BY room_id, id
) mb
WHERE bi.board_id IS NULL
  AND bi.room_id = mb.room_id;

-- 3) 收紧约束：迁移后全库 board_id 非空；所有存活写路径均显式带 board_id。
--    （SET NOT NULL 幂等：已非空列上重复执行无副作用。）
ALTER TABLE board_items ALTER COLUMN board_id SET NOT NULL;
