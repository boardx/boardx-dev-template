-- 033_board_room_public_id.sql — 全局唯一 id 阶段 1（issue #471）
-- boards/rooms 加 public_id 列，格式 "brd_<12位>" / "rm_<12位>"（生成入口见
-- packages/data/src/ids.ts 的 generateId()）。此列先允许 NULL——UNIQUE 约束在
-- Postgres 里天然放行多个 NULL 并存，不影响本迁移安全落地；既有行的回填走独立、
-- 幂等的 TS 脚本（packages/data/src/scripts/backfillPublicIds.ts），不在这里用
-- SQL 现拼随机串（那样会和 generateId() 的字母表/格式产生第二套实现，日后两边
-- 一改就分叉）。
--
-- NOT NULL 约束刻意不在本迁移里加：先落这一步（新建行仍可以 public_id 为空），
-- 待 backfill 脚本在目标环境确认跑完、所有既有行都已回填后，再单独一条迁移把
-- NOT NULL 收紧——阶段 1 范围明确只搭地基，不做强约束收口（见 #471 阶段划分）。
-- 路由/内部链接切换到用 public_id 是阶段 2，本迁移不影响任何现有查询路径。

-- （#530）唯一索引已移至 034（CREATE UNIQUE INDEX CONCURRENTLY，非事务迁移）：
-- 生产大表上在事务内建索引会阻塞写。本迁移只留加列（瞬时元数据操作）。
-- 已按旧版应用过本迁移的环境不受影响（_migrations 按文件名记账不重跑，
-- 其索引已存在，034 的 IF NOT EXISTS 会跳过）。
ALTER TABLE boards ADD COLUMN IF NOT EXISTS public_id text;

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS public_id text;
