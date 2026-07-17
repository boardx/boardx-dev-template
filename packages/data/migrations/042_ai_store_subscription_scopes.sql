-- 042_ai_store_subscription_scopes.sql — P27 F07
-- Personal subscriptions belong to one user in one consumer Team. Team
-- subscriptions belong to the consumer Team and are inherited by every member.

DROP INDEX IF EXISTS idx_ai_store_subscriptions_unique;
DROP INDEX IF EXISTS idx_ai_store_subscriptions_consumer_unique;

-- Older code allowed multiple admins to create equivalent Team subscriptions.
-- Keep the earliest active row before installing the Team-level unique index.
DELETE FROM ai_store_subscriptions AS duplicate
USING ai_store_subscriptions AS canonical
WHERE duplicate.id > canonical.id
  AND duplicate.item_id = canonical.item_id
  AND duplicate.consumer_team_id = canonical.consumer_team_id
  AND duplicate.scope = 'team'
  AND canonical.scope = 'team'
  AND duplicate.migration_quarantined_at IS NULL
  AND canonical.migration_quarantined_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_store_subscriptions_personal_unique
  ON ai_store_subscriptions(item_id, subscriber_user_id, consumer_team_id)
  WHERE scope = 'personal' AND migration_quarantined_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_store_subscriptions_team_unique
  ON ai_store_subscriptions(item_id, consumer_team_id)
  WHERE scope = 'team' AND migration_quarantined_at IS NULL;
