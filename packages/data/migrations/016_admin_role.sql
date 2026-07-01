-- 016_admin_role.sql — P15 Admin：平台级角色（SysAdmin 横切）
-- 与团队内 role（owner/admin/member，见 003_team.sql）是两套独立体系：
-- 本列是"平台"维度的全局角色，用于 /admin 后台门控。

ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role text NOT NULL DEFAULT 'user';
-- platform_role: 'user' | 'sysadmin'
