-- 047_ai_store_platform_team_recovery.sql — P27 F12
-- Legacy BoardX platform resources predate Team tenancy. Give only those
-- quarantined platform rows an explicit system Team; ambiguous personal and
-- Team rows remain quarantined for manual resolution.

INSERT INTO users (email, password_hash, first_name, last_name, provider)
VALUES ('ai-store-system@boardx.internal', NULL, 'BoardX', 'AI Store', 'email')
ON CONFLICT (email) DO NOTHING;

INSERT INTO teams (name, owner_user_id)
SELECT 'BoardX AI Store', service_user.id
FROM users AS service_user
WHERE service_user.email = 'ai-store-system@boardx.internal'
  AND NOT EXISTS (
    SELECT 1
    FROM teams AS existing_team
    WHERE existing_team.name = 'BoardX AI Store'
      AND existing_team.owner_user_id = service_user.id
  );

INSERT INTO team_members (team_id, user_id, role)
SELECT system_team.id, service_user.id, 'owner'
FROM users AS service_user
JOIN teams AS system_team
  ON system_team.owner_user_id = service_user.id
 AND system_team.name = 'BoardX AI Store'
WHERE service_user.email = 'ai-store-system@boardx.internal'
ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'owner';

UPDATE ai_store_items AS item
SET origin_team_id = system_team.id,
    migration_quarantined_at = NULL
FROM users AS service_user
JOIN teams AS system_team
  ON system_team.owner_user_id = service_user.id
 AND system_team.name = 'BoardX AI Store'
WHERE service_user.email = 'ai-store-system@boardx.internal'
  AND item.scope = 'platform'
  AND item.origin_team_id IS NULL
  AND item.migration_quarantined_at IS NOT NULL;
