-- 012_board_items_board_id.sql — CAP-CANVAS 画布 item 加 board 维度（ADR-0002，加法过渡）
-- 新 board-scoped item 写 board_id；旧 room-keyed item（F01-F04）board_id 为 NULL。
ALTER TABLE board_items ADD COLUMN IF NOT EXISTS board_id bigint REFERENCES boards(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_board_items_board ON board_items(board_id);
