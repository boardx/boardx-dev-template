-- 011_board_settings.sql — CAP-DATA 白板级设置/交互偏好（P7 F05）
ALTER TABLE boards ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;
