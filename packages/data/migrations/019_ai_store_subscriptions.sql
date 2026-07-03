-- 019_ai_store_subscriptions.sql — CAP-DATA AI Store 订阅（P11 F03）：ai_store_subscriptions
-- 记录用户对 AI Store 项目的订阅（个人订阅）或团队订阅（team_id 非空，由 Team Admin 代表团队订阅）。
-- 同一 (item_id, subscriber_user_id, team_id) 组合唯一：同一用户在同一团队上下文对同一项目只留一条订阅记录；
-- team_id 为 NULL 表示个人订阅，非 NULL 表示该记录是团队订阅（team_id 命中的团队）。

CREATE TABLE IF NOT EXISTS ai_store_subscriptions (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id            bigint NOT NULL REFERENCES ai_store_items(id) ON DELETE CASCADE,
  subscriber_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id            bigint REFERENCES teams(id) ON DELETE CASCADE,
  scope              text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'team')),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_store_subscriptions_unique
  ON ai_store_subscriptions(item_id, subscriber_user_id, COALESCE(team_id, 0));
CREATE INDEX IF NOT EXISTS idx_ai_store_subscriptions_subscriber
  ON ai_store_subscriptions(subscriber_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_store_subscriptions_item
  ON ai_store_subscriptions(item_id);
CREATE INDEX IF NOT EXISTS idx_ai_store_subscriptions_team
  ON ai_store_subscriptions(team_id);
