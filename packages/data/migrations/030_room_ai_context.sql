-- 030_room_ai_context.sql — uc-rr-010 Room AI 上下文字段回补（P20 F11）
-- 回补 oldcode room.schema.ts 的 description / aiInstruction；memories[] 依赖 p9 记忆机制，
-- 不在本迁移范围内（见 uc-rr-010「不包含」）。
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS ai_instruction text;
