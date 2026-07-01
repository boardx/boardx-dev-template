-- 016_payment_orders.sql — CAP-PAYMENT 支付订单（F05：扫码支付引擎地基）
-- payment_orders = Pro 升级 / Credit 购买共用的扫码支付订单。与 F01 的
-- credit_wallets/credit_transactions（若已存在）无关联，独立建表，避免跨 feature 冲突。
-- 生命周期：pending（已下单，等待扫码）→ paid（webhook 回调确认）→ failed / expired。
-- fulfillment_kind + fulfillment_payload 记录发放意图，供回调后调用的发放钩子（F02 加 Credit /
-- F04 升级计划）使用；本 feature 只落地 hook 接口，真正的 UI 消费在 F02/F04。

CREATE TABLE IF NOT EXISTS payment_orders (
  id                  text PRIMARY KEY,                 -- 订单号（对外可见，回调用于定位订单）
  user_id             bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id             bigint REFERENCES teams(id) ON DELETE SET NULL,  -- 团队 Credit 购买时非空
  fulfillment_kind    text NOT NULL,                    -- 'credit_purchase' | 'plan_upgrade'
  fulfillment_payload jsonb NOT NULL DEFAULT '{}'::jsonb, -- 发放所需参数（如 credits 数量 / plan id）
  amount_cents        integer NOT NULL,                 -- 订单金额（分），仅展示用
  currency            text NOT NULL DEFAULT 'USD',
  status              text NOT NULL DEFAULT 'pending',  -- pending | paid | failed | expired
  qr_payload          text NOT NULL,                    -- 二维码编码内容（stub 支付网关的扫码串）
  fulfilled_at        timestamptz,                       -- 幂等标记：非空=已完成发放，重复回调直接短路
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at DESC);
