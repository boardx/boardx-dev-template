-- 019_presentation_artifacts.sql — CAP-AI 演示文稿生成制品（p12-F02）
-- 与 studio_artifacts（p12-F01）同一异步管线模式（queued → processing → ready/error），
-- 独立建表而非复用 studio_artifacts：演示文稿需要额外的配置字段（topic/pages/style）+
-- 分页幻灯片元数据（slides，供聊天预览卡片翻页缩略图/全屏预览），且产物需要同时具备
-- PPTX 与 PDF 两种下载格式（studio_artifacts 每个制品只有单一 object_key/格式）。

CREATE TABLE IF NOT EXISTS presentation_artifacts (
  id              text PRIMARY KEY,
  room_id         bigint NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  chat_id         bigint NOT NULL REFERENCES room_chats(id) ON DELETE CASCADE,
  creator_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic           text NOT NULL DEFAULT '',
  source          text NOT NULL CHECK (source IN ('current_chat', 'room_files', 'instructions')),
  instructions    text NOT NULL DEFAULT '',
  pages           integer NOT NULL DEFAULT 8,
  style           text NOT NULL DEFAULT 'minimal',
  status          text NOT NULL DEFAULT 'queued', -- queued | processing | ready | error
  title           text,
  slides          jsonb,                           -- [{n, title, bullets: string[]}]（ready 后才有值）
  pptx_object_key text,                             -- ready 后才有值
  pdf_object_key  text,                             -- ready 后才有值
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentation_artifacts_chat ON presentation_artifacts(chat_id, id);
CREATE INDEX IF NOT EXISTS idx_presentation_artifacts_room ON presentation_artifacts(room_id);
