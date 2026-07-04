-- 026_room_files.sql — CAP-FILE 房间级文件库（p20-F03 / uc-rr-003，核心模型修正）
-- 推翻 uc-room-005 的"文件绑定聊天线程"错误建模：文件是房间资产，room_id 是唯一的
-- 所有权边界；chat_thread_id 退化为可选的"来源标注/过滤"维度，不影响可见性——
-- 同一房间的所有聊天线程左侧文件面板看到的是同一份 room_files 记录集合。
--
-- 迁移判据（L4 教训，见 022_retire_room_canvas.sql 的先例）：本仓库此前没有任何
-- 线程级文件表落过地（room-file.schema.ts 只是旧后端的字段参照，从未在本仓库建表/写数据，
-- 见 F03 交接记录），所以本迁移不存在"识别哪些存量行属于迁移产生"的问题——room_files
-- 是全新表，直接以 room_id NOT NULL 建表即满足不变量，无需回填。
-- 仍然按 L4 纪律预留 created_by_migration 标记列（专用标记，不用 name/自然键判重），
-- 以便未来若发现别处遗留的线程级文件数据需要回填时，判据从一开始就是标记列而非启发式匹配。
CREATE TABLE IF NOT EXISTS room_files (
  id              text PRIMARY KEY,
  room_id         bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  chat_thread_id  bigint REFERENCES room_chats(id) ON DELETE SET NULL, -- 可空：仅来源标注，非绑定
  uploader_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  file_type       text NOT NULL, -- 扩展名（小写，无点）
  file_size       bigint NOT NULL,
  storage_path    text NOT NULL, -- 对象存储 key，见 @repo/storage buildRoomFileObjectKey
  status          text NOT NULL DEFAULT 'ready', -- ready | deleted（软删）
  deleted_at      timestamptz,
  created_by_migration text, -- 专用标记列：非 NULL 表示该行由某次迁移脚本回填而非用户上传产生
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_room_files_room ON room_files(room_id, created_at DESC) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS idx_room_files_thread ON room_files(chat_thread_id) WHERE chat_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_room_files_uploader ON room_files(uploader_id);

-- DB 级不变量断言：room_id 恒非空（迁移脚本自检，输出留 evidence，不依赖应用层纪律）。
DO $$
DECLARE
  null_room_id_count bigint;
BEGIN
  SELECT count(*) INTO null_room_id_count FROM room_files WHERE room_id IS NULL;
  IF null_room_id_count > 0 THEN
    RAISE EXCEPTION 'room_files 不变量违反：% 行 room_id 为空（房间文件必须归属房间）', null_room_id_count;
  END IF;
  RAISE NOTICE 'room_files 不变量断言通过：room_id 全部非空（0 行违反）';
END $$;
