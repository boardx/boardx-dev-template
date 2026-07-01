-- 017_ai_store_item_config.sql — P11 F02：AI Store 创建器配置落库。
-- 图标/封面继续复用 cover；创建器的结构化配置写入 config。

ALTER TABLE ai_store_items
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;
