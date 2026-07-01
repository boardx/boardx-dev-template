import { NextResponse } from "next/server";
import { findTransactionByLabel, getOrCreateTeamWallet, getTeam, recordTransaction } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-002 — 后台为团队手动增加 Credit（F03）。
// 复用 p14 的 credit_wallets/credit_transactions 仓储（packages/data/src/credits.ts）：
// getOrCreateTeamWallet 幂等取/建团队钱包，recordTransaction 写一笔 purchase+grant 流水并原子更新余额。
// 不写平行的积分变更路径——与 F02（用户手动上分）应共用同一套仓储函数，只是 wallet scope 不同。
//
// review 加固（三点，见 PR #157 review）：
// 1. 幂等：客户端每次提交生成一个 Idempotency-Key（uuid），编码进流水的 label 一并落库；
//    重放/重复点击带同一 key 命中已有流水就直接返回，不二次入账。不加迁移/列，靠
//    label 唯一性（uuid）+ findTransactionByLabel 精确查重。
// 2. 审计：把执行操作的 SysAdmin（gate.user.id + email）写进 description，financial action
//    必须可追溯到具体操作者。
// 3. note 长度上限 200 字符，防止无界输入写入 description。
const NOTE_MAX_LEN = 200;

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
  const note = String(body.note ?? "").trim().slice(0, NOTE_MAX_LEN);

  // 幂等 key：优先取客户端头（每次提交生成一个，双击/重试会带同一个值）；
  // 没带 key 的调用方（如直接打 API 的越权测试）视为各自独立请求，不做查重。
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();

  const wallet = await getOrCreateTeamWallet(teamId);
  const label = idempotencyKey ? `Admin grant · idem:${idempotencyKey}` : "Admin grant";

  if (idempotencyKey) {
    const existing = await findTransactionByLabel(wallet.id, label);
    if (existing) {
      // 命中同一幂等 key 的既有流水：视为重放/双击，直接返回当前余额，不重复入账。
      const current = await getOrCreateTeamWallet(teamId);
      return NextResponse.json({ wallet: { balance: Number(current.balance) }, idempotent: true });
    }
  }

  const operator = `${gate.user.email} (uid:${gate.user.id})`;
  const description = note
    ? `管理员手动上分 · 操作人 ${operator} · ${note}`
    : `管理员手动上分 · 操作人 ${operator}`;

  await recordTransaction(wallet.id, {
    kind: "purchase",
    amount,
    grant: true,
    label,
    description,
  });

  const updated = await getOrCreateTeamWallet(teamId);
  return NextResponse.json({ wallet: { balance: Number(updated.balance) } });
}
