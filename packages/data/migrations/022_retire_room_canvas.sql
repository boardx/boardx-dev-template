-- 022_retire_room_canvas.sql — CAP-DATA 下线 legacy 单画布模型（uc-rr-009 / p20-F10）
-- 005 时代「房间=单块画布」的 board_items 是 room-keyed（board_id IS NULL）。
-- 本迁移把这些 legacy 行回填到每房间自动创建的默认 board（"Main board"），
-- 然后给 board_id 加 NOT NULL 约束（此后唯一写路径 /api/boards/[id]/items 恒带 board_id）。
-- 幂等可重跑：重复执行时不重复建板、不重复回填、约束已存在则跳过。
--
-- 回填目标板用专用标记列 created_by_migration 识别（不可与用户数据碰撞）：
-- 用户自建的同名 "Main board" 一律不作为回填目标，避免 legacy 数据混入用户板（review PR#312 必修项）。

-- 0) 专用标记列：仅本迁移写入，正常业务代码不读不写。
ALTER TABLE boards ADD COLUMN IF NOT EXISTS created_by_migration text;

-- 1) 为每个仍有 legacy items（board_id IS NULL）的房间建一块默认 board（带迁移标记）。
--    只认标记判重，不按名字判重：用户已有同名板也照建新板，绝不复用用户板。
--    （E1：无 legacy items 的房间不建空板。）
INSERT INTO boards (room_id, team_id, name, owner_user_id, created_by_migration)
SELECT r.id, r.team_id, 'Main board', r.owner_user_id, '022_retire_room_canvas'
FROM rooms r
WHERE EXISTS (
        SELECT 1 FROM board_items bi
        WHERE bi.room_id = r.id AND bi.board_id IS NULL
      )
  AND NOT EXISTS (
        SELECT 1 FROM boards b
        WHERE b.room_id = r.id AND b.created_by_migration = '022_retire_room_canvas'
      );

-- 2) 把 legacy items 回填到所在房间**本迁移创建**的板（标记匹配；防御性 DISTINCT ON 保确定性）。
UPDATE board_items bi
SET board_id = mb.board_id
FROM (
  SELECT DISTINCT ON (room_id) room_id, id AS board_id
  FROM boards
  WHERE created_by_migration = '022_retire_room_canvas'
  ORDER BY room_id, id
) mb
WHERE bi.board_id IS NULL
  AND bi.room_id = mb.room_id;

-- 3) 收紧约束：迁移后全库 board_id 非空；所有存活写路径均显式带 board_id。
--    （SET NOT NULL 幂等：已非空列上重复执行无副作用。）
ALTER TABLE board_items ALTER COLUMN board_id SET NOT NULL;
