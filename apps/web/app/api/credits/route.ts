import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-credits-001-view-wallet —— Credit 钱包只读视图的最小 API。
// 范围内只需「查看」：余额摘要 + 积分记录列表（usage / purchase）。
// 不接支付结算、不接 token 计量（UC「不包含」）。这里用确定性的内存派生数据，
// 按 userId 派生，保证同一用户多次请求稳定、不同用户互不串台，且 e2e 可复现。

interface CreditRecord {
  id: string;
  kind: "usage" | "purchase";
  when: string;
  /** usage: 触发用户 / purchase: 充值类型 */
  label: string;
  /** 描述：usage 是消耗原因，purchase 是描述 · 来源 */
  description: string;
  /** 变更数量（usage 为负，purchase 为正） */
  amount: number;
  /** 变更后余额 */
  balance: number;
}

interface Wallet {
  balance: number;
  totalPurchased: number;
  totalGranted: number;
  totalConsumed: number;
  records: CreditRecord[];
}

const EMPTY_WALLET: Wallet = {
  balance: 0,
  totalPurchased: 0,
  totalGranted: 0,
  totalConsumed: 0,
  records: [],
};

// 用确定性样例钱包（与设计 CREDITS 稿对齐：余额 / 累计购买 / 授予 / 消耗 + Usage/Purchase 两类流水）。
function sampleWallet(displayName: string): Wallet {
  const records: CreditRecord[] = [
    {
      id: "rec_p1",
      kind: "purchase",
      when: "1w ago",
      label: "Purchase",
      description: "5,500 credit pack · WeChat Pay",
      amount: 5500,
      balance: 12400,
    },
    {
      id: "rec_g1",
      kind: "purchase",
      when: "3w ago",
      label: "Grant",
      description: "Onboarding bonus · Admin",
      amount: 8000,
      balance: 6900,
    },
    {
      id: "rec_u1",
      kind: "usage",
      when: "2d ago",
      label: displayName,
      description: "Agent run · summarizer",
      amount: -1200,
      balance: 12400,
    },
    {
      id: "rec_u2",
      kind: "usage",
      when: "5d ago",
      label: displayName,
      description: "Image generation",
      amount: -400,
      balance: 13600,
    },
  ];
  return {
    balance: 12400,
    totalPurchased: 120000,
    totalGranted: 8000,
    totalConsumed: 116000,
    records,
  };
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  // `?state=empty` 强制返回空钱包，便于 e2e 稳定覆盖空状态分支（注册用户 id 不可控，
  // 不能靠 id 奇偶判断）。默认返回与设计稿对齐的样例钱包。
  const state = new URL(req.url).searchParams.get("state");
  const wallet = state === "empty" ? EMPTY_WALLET : sampleWallet(user.first_name || user.email);
  return NextResponse.json({ wallet });
}
