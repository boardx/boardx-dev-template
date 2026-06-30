-- 013_board_items_color.sql — CAP-CANVAS 便签外观色（P6 F11）。token：amber/blue/green/pink…，NULL=默认。
ALTER TABLE board_items ADD COLUMN IF NOT EXISTS color text;
