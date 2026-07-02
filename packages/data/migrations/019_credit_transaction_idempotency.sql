-- 019_credit_transaction_idempotency.sql — 手动上分幂等 key 的数据库唯一性
-- 仅约束带 idem key 的流水，避免影响历史/常规重复 label（如 Admin grant、Trial bonus）。
--
-- 回填（PR #177 review）：在这条唯一索引落地前，user/team 两条手动上分路由都只用应用层
-- check-then-act（SELECT 查重 → 未命中才 UPDATE 余额 + INSERT 流水）做幂等，并发下可能已经
-- 留下重复的 (wallet_id, label) 流水——每条重复流水都各自把 balance/total_granted 加过一次。
-- 直接建唯一索引会在这类环境上因历史重复行报错，且就算不报错，钱包余额里也还留着被
-- 双记的那部分。这里先按已知语义（目前唯一会写 idem: label 的调用方是管理员手动上分，
-- kind='purchase' 且 grant=true）回滚多余流水对余额的影响，只保留每组最早一条，再建索引。
DO $$
DECLARE
  dup RECORD;
  keep_id bigint;
BEGIN
  FOR dup IN
    SELECT wallet_id, label
    FROM credit_transactions
    WHERE label LIKE '%idem:%'
    GROUP BY wallet_id, label
    HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM credit_transactions
    WHERE wallet_id = dup.wallet_id AND label = dup.label
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- 先把多余流水已经计入的余额/累计发放金额减回去，再删除多余流水。
    UPDATE credit_wallets w
    SET balance = balance - extra.total_amount,
        total_granted = total_granted - extra.total_amount
    FROM (
      SELECT COALESCE(SUM(amount), 0) AS total_amount
      FROM credit_transactions
      WHERE wallet_id = dup.wallet_id AND label = dup.label AND id <> keep_id
    ) extra
    WHERE w.id = dup.wallet_id;

    DELETE FROM credit_transactions
    WHERE wallet_id = dup.wallet_id AND label = dup.label AND id <> keep_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_wallet_idem_label_uq
  ON credit_transactions (wallet_id, label)
  WHERE label LIKE '%idem:%';
