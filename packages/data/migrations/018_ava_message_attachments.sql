-- 018_ava_message_attachments.sql — CAP-FILE AVA 聊天附件（P9 uc-ava-007 / F08）
-- ava_message_attachments = 挂在某条 ava_messages 上的文件/图片/音频附件。
-- 复用 p10 CAP-FILE 的对象存储层（@repo/storage），但走独立的 object key 前缀
-- （ava/{userId}/{attachmentId}/{文件名}），与知识库文件（kb/...）隔离，互不影响权限模型。
--
-- 生命周期：用户在 composer 选择/拖入文件 → 前端立即 POST 到
-- /api/ava/threads/:id/attachments 落地对象存储 + 建一条 message_id 为空的记录
-- （uploading 阶段，供预览条展示进度/失败/重试）→ 发送消息时把已上传成功的
-- attachment id 关联到新插入的 ava_messages 行（message_id 回填）。
-- message_id 为空 = 尚未随消息发出的"暂存"附件；发送成功后才算真正进入聊天历史。
CREATE TABLE IF NOT EXISTS ava_message_attachments (
  id            text PRIMARY KEY,
  thread_id     bigint NOT NULL REFERENCES ava_threads(id) ON DELETE CASCADE,
  message_id    bigint REFERENCES ava_messages(id) ON DELETE CASCADE,
  owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL DEFAULT 'file', -- image | audio | file（前端按 mime 分类展示缩略图/图标）
  name          text NOT NULL,
  mime_type     text NOT NULL,
  size_bytes    bigint NOT NULL,
  object_key    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ava_attachments_thread ON ava_message_attachments(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ava_attachments_message ON ava_message_attachments(message_id);
