-- 016_credits.sql — uc-credits-001 CAP-DATA 积分钱包地基
-- credit_wallets：scope=personal（owner_user_id）或 scope=team（team_id）各一条钱包记录。
-- credit_transactions：钱包流水（purchase=购买/授予正数，usage=消耗负数），balance_after 为变更后余额。
-- AI 消耗扣费（p9/p12）与购买（F02/F05）后续只需 INSERT credit_transactions + 更新 wallet 汇总字段，
-- 本迁移只建地基表，不建扣费/支付逻辑。

CREATE TABLE IF NOT EXISTS credit_wallets (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope           text NOT NULL,                 -- personal | team
  owner_user_id   bigint REFERENCES users(id) ON DELETE CASCADE,
  team_id         bigint REFERENCES teams(id) ON DELETE CASCADE,
  balance         bigint NOT NULL DEFAULT 0,
  total_purchased bigint NOT NULL DEFAULT 0,
  total_granted   bigint NOT NULL DEFAULT 0,
  total_consumed  bigint NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_wallets_scope_chk CHECK (scope IN ('personal', 'team')),
  CONSTRAINT credit_wallets_owner_xor_team_chk CHECK (
    (scope = 'personal' AND owner_user_id IS NOT NULL AND team_id IS NULL) OR
    (scope = 'team' AND team_id IS NOT NULL AND owner_user_id IS NULL)
  )
);

-- 每个用户最多一个 personal 钱包；每个团队最多一个 team 钱包。
CREATE UNIQUE INDEX IF NOT EXISTS credit_wallets_personal_uq
  ON credit_wallets (owner_user_id) WHERE scope = 'personal';
CREATE UNIQUE INDEX IF NOT EXISTS credit_wallets_team_uq
  ON credit_wallets (team_id) WHERE scope = 'team';

CREATE TABLE IF NOT EXISTS credit_transactions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id     bigint NOT NULL REFERENCES credit_wallets(id) ON DELETE CASCADE,
  kind          text NOT NULL,                   -- usage | purchase
  label         text NOT NULL DEFAULT '',
  description   text NOT NULL DEFAULT '',
  amount        bigint NOT NULL,                 -- usage 为负，purchase 为正
  balance_after bigint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_transactions_kind_chk CHECK (kind IN ('usage', 'purchase'))
);

CREATE INDEX IF NOT EXISTS credit_transactions_wallet_idx
  ON credit_transactions (wallet_id, created_at DESC);
