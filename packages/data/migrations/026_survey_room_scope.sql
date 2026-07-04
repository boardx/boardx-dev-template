-- 026_survey_room_scope.sql — CAP-DATA Room Survey 入口（P20 F08 / uc-rr-007）
-- surveys 增加可空 room_id：scope='room' 时归属房间；向后兼容——存量问卷 room_id 恒为 NULL，
-- 迁移后仍然只按既有 scope（private/team）解释，不会被误判为房间问卷。
-- 房间问卷的管理权属于房间 owner/admin（见 packages/data/src/survey.ts canManageSurveyScope），
-- 与团队问卷管理权（问卷 owner_user_id）彻底分离，修正 uc-room-007 的权限域错位。

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS room_id bigint REFERENCES rooms(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_surveys_room ON surveys(room_id);

-- 迁移不变量断言（供 evidence 记录）：
-- 1) 存量问卷（本迁移之前已存在的所有行）room_id 必须为 NULL —— 因为 ADD COLUMN 对已有行
--    只会填充 NULL，不会推导出房间归属；这里显式断言，防止未来有人在同一迁移里误填默认值。
-- 2) room_id 非空的行，scope 必须是 'room'（应用层保证；这里不加 DB CHECK 是因为
--    scope 是自由 text 字段，历史上没有枚举约束，避免引入新约束打断现有数据/迁移顺序）。
DO $$
DECLARE
  legacy_non_null_count bigint;
BEGIN
  SELECT count(*) INTO legacy_non_null_count
  FROM surveys
  WHERE room_id IS NOT NULL AND scope <> 'room';
  IF legacy_non_null_count > 0 THEN
    RAISE EXCEPTION '迁移不变量违反：存在 room_id 非空但 scope 不是 room 的问卷行（% 条）', legacy_non_null_count;
  END IF;
  RAISE NOTICE '迁移不变量断言通过：room_id 非空的问卷行 scope 均为 room（不变量校验 0 条违反）';
END $$;
