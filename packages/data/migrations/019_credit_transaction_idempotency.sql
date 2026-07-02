-- 019_credit_transaction_idempotency.sql — 手动上分幂等 key 的数据库唯一性
-- 仅约束带 idem key 的流水，避免影响历史/常规重复 label（如 Admin grant、Trial bonus）。

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_wallet_idem_label_uq
  ON credit_transactions (wallet_id, label)
  WHERE label LIKE '%idem:%';
