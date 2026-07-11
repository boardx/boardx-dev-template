-- migrate:no-transaction
-- 034_public_id_concurrent_index.sql — public_id 唯一索引改为 CONCURRENTLY 建（issue #530）
-- 生产大表上非 CONCURRENTLY 的 CREATE INDEX 会持写锁直到建完；CONCURRENTLY 不能在
-- 事务块内运行 → 本迁移走 runner 的非事务路径（首行指令）。全部语句幂等
--（IF NOT EXISTS），失败重跑安全。已用旧方式建过索引的环境（dev/devapp）：
-- IF NOT EXISTS 直接跳过，零影响。
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_boards_public_id ON boards(public_id);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_public_id ON rooms(public_id);
