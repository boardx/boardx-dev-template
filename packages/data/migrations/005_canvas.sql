-- 005_canvas.sql — CAP-CANVAS 板内容：board_items（属于某 room）

CREATE TABLE IF NOT EXISTS board_items (
  id         text PRIMARY KEY,
  room_id    bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'note',   -- note | rect
  x          integer NOT NULL DEFAULT 0,
  y          integer NOT NULL DEFAULT 0,
  w          integer NOT NULL DEFAULT 160,
  h          integer NOT NULL DEFAULT 100,
  text       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_items_room ON board_items(room_id);
