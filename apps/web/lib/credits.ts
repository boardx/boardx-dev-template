// apps/web/lib/credits.ts — uc-credits-001-view-wallet 共享逻辑
// 供 app/api/credits/route.ts（兼容旧路径）与 app/api/credits/wallet/route.ts（真实 scope 路由）复用。
import {
  getOrCreatePersonalWallet,
  getOrCreateTeamWallet,
  getPersonalWallet,
  getTeamWallet,
  listTransactions,
  recordTransaction,
  type CreditWallet,
} from "@repo/data";

export interface WalletRecordDto {
  id: string;
  kind: "usage" | "purchase";
  when: string;
  label: string;
  description: string;
  amount: number;
  balance: number;
}

export interface WalletPayload {
  scope: "personal" | "team";
  balance: number;
  totalPurchased: number;
  totalGranted: number;
  totalConsumed: number;
  records: WalletRecordDto[];
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/**
 * 演示流水种子：新钱包（余额 0 且无流水）首次访问即写入一组确定性样例流水
 * （授予 + 购买 + 两笔消耗），与设计稿的四摘要卡片对齐。通过 recordTransaction
 * 写真实表（CAP-DATA 写读闭环），非临时内存 mock；钱包一旦已有流水就不会重复播种（幂等）。
 * 真实购买/消耗接入后（F02/F05/p9/p12）会不断追加真实流水，本函数只负责补一个
 * 空钱包的初始演示态。调用方在 `?state=empty` 时应跳过本函数以展示真空态。
 */
export async function seedDemoIfEmpty(wallet: CreditWallet, label: string): Promise<CreditWallet> {
  if (Number(wallet.balance) !== 0 || Number(wallet.total_purchased) !== 0) return wallet;
  const existing = await listTransactions(wallet.id, 1);
  if (existing.length > 0) return wallet;

  await recordTransaction(wallet.id, {
    kind: "purchase",
    amount: 8000,
    grant: true,
    label: "Grant",
    description: "Onboarding bonus · Admin",
  });
  await recordTransaction(wallet.id, {
    kind: "purchase",
    amount: 5500,
    label: "Purchase",
    description: "5,500 credit pack · WeChat Pay",
  });
  await recordTransaction(wallet.id, {
    kind: "usage",
    amount: -400,
    label,
    description: "Image generation",
  });
  await recordTransaction(wallet.id, {
    kind: "usage",
    amount: -1200,
    label,
    description: "Agent run · summarizer",
  });

  const fresh =
    wallet.scope === "team" ? await getTeamWallet(wallet.team_id!) : await getPersonalWallet(wallet.owner_user_id!);
  return fresh ?? wallet;
}

export async function walletToPayload(wallet: CreditWallet, scope: "personal" | "team"): Promise<WalletPayload> {
  const txs = await listTransactions(wallet.id);
  return {
    scope,
    balance: Number(wallet.balance),
    totalPurchased: Number(wallet.total_purchased),
    totalGranted: Number(wallet.total_granted),
    totalConsumed: Number(wallet.total_consumed),
    records: txs.map((t) => ({
      id: String(t.id),
      kind: t.kind,
      when: timeAgo(t.created_at),
      label: t.label,
      description: t.description,
      amount: Number(t.amount),
      balance: Number(t.balance_after),
    })),
  };
}

/** 取（必要时创建并播种）个人钱包的完整视图；`forceEmpty` 时跳过播种展示真空态。 */
export async function loadPersonalWallet(userId: number, displayName: string, forceEmpty: boolean): Promise<WalletPayload> {
  let wallet = await getOrCreatePersonalWallet(userId);
  if (!forceEmpty) wallet = await seedDemoIfEmpty(wallet, displayName);
  return walletToPayload(wallet, "personal");
}

/** 取（必要时创建并播种）团队钱包的完整视图；`forceEmpty` 时跳过播种展示真空态。 */
export async function loadTeamWallet(teamId: number, forceEmpty: boolean): Promise<WalletPayload> {
  let wallet = await getOrCreateTeamWallet(teamId);
  if (!forceEmpty) wallet = await seedDemoIfEmpty(wallet, "Team usage");
  return walletToPayload(wallet, "team");
}
