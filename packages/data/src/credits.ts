// packages/data/src/credits.ts — CAP-DATA 积分钱包仓储（uc-credits-001 地基）
// 钱包分两种 scope：personal（owner_user_id）/ team（team_id）。
// AI 消耗扣费（p9/p12）、购买入账（F02/F05）后续复用 recordTransaction，本文件不建扣费/支付逻辑。
import { query } from "./index";

export type WalletScope = "personal" | "team";
export type TransactionKind = "usage" | "purchase";

export interface CreditWallet {
  id: number;
  scope: WalletScope;
  owner_user_id: number | null;
  team_id: number | null;
  balance: number;
  total_purchased: number;
  total_granted: number;
  total_consumed: number;
  created_at: string;
}

export interface CreditTransaction {
  id: number;
  wallet_id: number;
  kind: TransactionKind;
  label: string;
  description: string;
  amount: number;
  balance_after: number;
  created_at: string;
}

const WALLET_COLS =
  "id, scope, owner_user_id, team_id, balance, total_purchased, total_granted, total_consumed, created_at";

export async function getPersonalWallet(userId: number): Promise<CreditWallet | undefined> {
  const rows = await query<CreditWallet>(
    `SELECT ${WALLET_COLS} FROM credit_wallets WHERE scope = 'personal' AND owner_user_id = $1`,
    [userId]
  );
  return rows[0];
}

export async function getTeamWallet(teamId: number): Promise<CreditWallet | undefined> {
  const rows = await query<CreditWallet>(
    `SELECT ${WALLET_COLS} FROM credit_wallets WHERE scope = 'team' AND team_id = $1`,
    [teamId]
  );
  return rows[0];
}

/** 幂等创建（不存在才建），返回该用户的个人钱包。 */
export async function getOrCreatePersonalWallet(userId: number): Promise<CreditWallet> {
  const existing = await getPersonalWallet(userId);
  if (existing) return existing;
  const rows = await query<CreditWallet>(
    `INSERT INTO credit_wallets (scope, owner_user_id) VALUES ('personal', $1)
     ON CONFLICT (owner_user_id) WHERE scope = 'personal' DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id
     RETURNING ${WALLET_COLS}`,
    [userId]
  );
  return rows[0]!;
}

/** 幂等创建（不存在才建），返回该团队的团队钱包。 */
export async function getOrCreateTeamWallet(teamId: number): Promise<CreditWallet> {
  const existing = await getTeamWallet(teamId);
  if (existing) return existing;
  const rows = await query<CreditWallet>(
    `INSERT INTO credit_wallets (scope, team_id) VALUES ('team', $1)
     ON CONFLICT (team_id) WHERE scope = 'team' DO UPDATE SET team_id = EXCLUDED.team_id
     RETURNING ${WALLET_COLS}`,
    [teamId]
  );
  return rows[0]!;
}

export async function listTransactions(walletId: number, limit = 50): Promise<CreditTransaction[]> {
  return query<CreditTransaction>(
    `SELECT id, wallet_id, kind, label, description, amount, balance_after, created_at
     FROM credit_transactions WHERE wallet_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
    [walletId, limit]
  );
}

/**
 * 记一笔流水并原子更新钱包汇总字段（余额 + 对应累计）。
 * usage：amount 传负数，累加 total_consumed（取绝对值）。
 * purchase：amount 传正数；grant=true 累加 total_granted，否则累加 total_purchased。
 * 供 F02（购买）、F05（支付回调发放）、p9/p12（AI 消耗扣费）复用，本 feature 不调用写入侧。
 */
export async function recordTransaction(
  walletId: number,
  input: { kind: TransactionKind; amount: number; label?: string; description?: string; grant?: boolean }
): Promise<CreditTransaction> {
  const totalCol =
    input.kind === "usage" ? "total_consumed" : input.grant ? "total_granted" : "total_purchased";
  const delta = input.kind === "usage" ? Math.abs(input.amount) : input.amount;

  const walletRows = await query<{ balance: number }>(
    `UPDATE credit_wallets SET balance = balance + $2, ${totalCol} = ${totalCol} + $3
     WHERE id = $1 RETURNING balance`,
    [walletId, input.amount, delta]
  );
  const balanceAfter = walletRows[0]!.balance;

  const rows = await query<CreditTransaction>(
    `INSERT INTO credit_transactions (wallet_id, kind, label, description, amount, balance_after)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, wallet_id, kind, label, description, amount, balance_after, created_at`,
    [walletId, input.kind, input.label ?? "", input.description ?? "", input.amount, balanceAfter]
  );
  return rows[0]!;
}
