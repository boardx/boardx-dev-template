-- 039_ai_store_team_tenancy.sql — P27 F01
-- Active AI Store resources and subscriptions require a Team. Historical rows
-- that cannot be assigned without guessing remain intact but are quarantined
-- and recorded for manual resolution.

ALTER TABLE ai_store_items
  ADD COLUMN IF NOT EXISTS origin_team_id bigint REFERENCES teams(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS migration_quarantined_at timestamptz;

ALTER TABLE ai_store_subscriptions
  ADD COLUMN IF NOT EXISTS consumer_team_id bigint REFERENCES teams(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS migration_quarantined_at timestamptz;

CREATE TABLE IF NOT EXISTS ai_store_team_migration_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('resource', 'subscription')),
  entity_id   bigint NOT NULL,
  reason      text NOT NULL,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, reason)
);

-- Preserve every explicit legacy Team assignment.
UPDATE ai_store_items
SET origin_team_id = team_id
WHERE origin_team_id IS NULL AND team_id IS NOT NULL;

-- An owner is a safe source only when they belong to exactly one Team.
WITH unique_owner_team AS (
  SELECT user_id, MIN(team_id) AS team_id
  FROM team_members
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE ai_store_items AS item
SET origin_team_id = unique_owner_team.team_id
FROM unique_owner_team
WHERE item.origin_team_id IS NULL
  AND item.owner_user_id = unique_owner_team.user_id;

INSERT INTO ai_store_team_migration_audit (entity_type, entity_id, reason, details)
SELECT
  'resource',
  item.id,
  'unresolved_origin_team',
  jsonb_build_object(
    'ownerUserId', item.owner_user_id,
    'legacyTeamId', item.team_id,
    'scope', item.scope
  )
FROM ai_store_items AS item
WHERE item.origin_team_id IS NULL
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

UPDATE ai_store_items
SET migration_quarantined_at = COALESCE(migration_quarantined_at, now())
WHERE origin_team_id IS NULL;

-- Legacy Team subscriptions already carry their consumer Team.
UPDATE ai_store_subscriptions
SET consumer_team_id = team_id
WHERE consumer_team_id IS NULL AND team_id IS NOT NULL;

-- A historical personal subscription is safe only when its subscriber has one Team.
WITH unique_subscriber_team AS (
  SELECT user_id, MIN(team_id) AS team_id
  FROM team_members
  GROUP BY user_id
  HAVING COUNT(*) = 1
)
UPDATE ai_store_subscriptions AS subscription
SET consumer_team_id = unique_subscriber_team.team_id
FROM unique_subscriber_team
WHERE subscription.consumer_team_id IS NULL
  AND subscription.subscriber_user_id = unique_subscriber_team.user_id;

INSERT INTO ai_store_team_migration_audit (entity_type, entity_id, reason, details)
SELECT
  'subscription',
  subscription.id,
  'unresolved_consumer_team',
  jsonb_build_object(
    'subscriberUserId', subscription.subscriber_user_id,
    'legacyTeamId', subscription.team_id,
    'scope', subscription.scope
  )
FROM ai_store_subscriptions AS subscription
WHERE subscription.consumer_team_id IS NULL
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

UPDATE ai_store_subscriptions
SET migration_quarantined_at = COALESCE(migration_quarantined_at, now())
WHERE consumer_team_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_store_items_origin_team
  ON ai_store_items(origin_team_id, updated_at DESC)
  WHERE migration_quarantined_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_store_subscriptions_consumer_team
  ON ai_store_subscriptions(consumer_team_id, created_at DESC)
  WHERE migration_quarantined_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_store_subscriptions_consumer_unique
  ON ai_store_subscriptions(item_id, subscriber_user_id, consumer_team_id, scope)
  WHERE migration_quarantined_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_store_items_active_origin_team_check'
  ) THEN
    ALTER TABLE ai_store_items
      ADD CONSTRAINT ai_store_items_active_origin_team_check
      CHECK (origin_team_id IS NOT NULL OR migration_quarantined_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_store_subscriptions_active_consumer_team_check'
  ) THEN
    ALTER TABLE ai_store_subscriptions
      ADD CONSTRAINT ai_store_subscriptions_active_consumer_team_check
      CHECK (consumer_team_id IS NOT NULL OR migration_quarantined_at IS NOT NULL);
  END IF;
END
$$;
