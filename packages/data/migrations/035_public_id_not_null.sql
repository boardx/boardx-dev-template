-- 035_public_id_not_null.sql — public_id 收紧 NOT NULL（issue #530 / #471 阶段收口）
-- 前置（fail-closed，故意不做条件跳过）：目标环境必须已跑完回填脚本
--   pnpm --filter @repo/data run backfill:public-id
-- 仍有 NULL 行时本迁移会直接失败并回滚——这是正确行为：宁可部署红，不可让
-- "看似收紧实际没收紧"的状态静默存在。fresh 环境零行天然通过；devapp 已于
-- 2026-07-11 回填确认（boards 2 行 / rooms 1 行）。
ALTER TABLE boards ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE rooms ALTER COLUMN public_id SET NOT NULL;
