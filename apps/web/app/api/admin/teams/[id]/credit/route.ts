import { NextResponse } from "next/server";
import { getOrCreateTeamWallet, getTeam, recordTransaction } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-002 — 后台为团队手动增加 Credit（F03）。
// 复用 p14 的 credit_wallets/credit_transactions 仓储（packages/data/src/credits.ts）：
// getOrCreateTeamWallet 幂等取/建团队钱包，recordTransaction 写一笔 purchase+grant 流水并原子更新余额。
// 不写平行的积分变更路径——与 F02（用户手动上分）应共用同一套仓储函数，只是 wallet scope 不同。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const teamId = Number(params.id);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return NextResponse.json({ error: "无效的团队 ID" }, { status: 400 });
  }
  const team = await getTeam(teamId);
  if (!team) return NextResponse.json({ error: "团队不存在" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { amount?: unknown; note?: unknown };
  const amount = Math.trunc(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ errors: { amount: "增加额度必须是大于 0 的整数" } }, { status: 400 });
  }
  const note = String(body.note ?? "").trim();

  const wallet = await getOrCreateTeamWallet(teamId);
  await recordTransaction(wallet.id, {
    kind: "purchase",
    amount,
    grant: true,
    label: "Admin grant",
    description: note ? `管理员手动上分 · ${note}` : "管理员手动上分",
  });

  const updated = await getOrCreateTeamWallet(teamId);
  return NextResponse.json({ wallet: { balance: Number(updated.balance) } });
}
