-- 020_ai_store_share.sql — CAP-DATA AI Store 项目分享管理（P11 F05，uc-ai-store-005）
-- 拥有者为 ai_store_items 生成/关闭「管理授权链接」；被授权协作者打开链接后记录为该项目的
-- grantee（ai_store_item_grants），据此驱动 Authorized/Shared 视图与卡片上的已授权标识。
-- 授权以 item + shareToken + grantee 表达：token 存在 ai_store_items 上（同一项目同一时刻
-- 只有一条有效链接，符合“关闭后旧链接立即失效”的要求）；grantee 关系持久化在独立表，
-- 关闭分享不清空已授权用户列表（关闭只是让新访问者无法再通过链接加入，已授权用户仍在
-- 列表中直到被拥有者显式移除——对应 uc-ai-store-005 步骤 11「移除某个授权用户」）。

ALTER TABLE ai_store_items
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_store_items_share_token
  ON ai_store_items(share_token)
  WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_store_item_grants (
  item_id    bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_via_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_store_item_grants_user ON ai_store_item_grants(user_id);
