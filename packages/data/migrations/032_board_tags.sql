-- board 多标签(p24 F02)。单值 category 不够,用 text[] 存多标签。
ALTER TABLE boards ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_boards_tags ON boards USING GIN (tags);
