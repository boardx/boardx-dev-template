-- 003_team.sql — CAP-AUTH 团队：teams / team_members / team_invites

CREATE TABLE IF NOT EXISTS teams (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id    bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',   -- owner | admin | member
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_invites (
  token       text PRIMARY KEY,
  team_id     bigint NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
