-- 018_user_plan.sql — P14 F04 personal billing plan
-- users.plan_id is the source of truth for the current personal subscription tier.
-- Billing fulfillment upgrades this value after a paid plan_upgrade order.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_id text NOT NULL DEFAULT 'free';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_plan_id_chk;

ALTER TABLE users
  ADD CONSTRAINT users_plan_id_chk CHECK (plan_id IN ('free', 'pro'));

CREATE INDEX IF NOT EXISTS idx_users_plan_id ON users(plan_id);
