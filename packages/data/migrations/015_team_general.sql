-- 014_team_general.sql — uc-team-007 团队通用设置：description + team_type

ALTER TABLE teams ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_type text NOT NULL DEFAULT 'standard';
