import { NextResponse } from "next/server";
import { getOrCreateTeamWallet, getTeam, recordTransaction, recordTransactionIdempotent } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-002 — 后台为团队手动增加 Credit（F03）。
// 复用 p14 的 credit_wallets/credit_transactions 仓储（packages/data/src/credits.ts）：
// getOrCreateTeamWallet 幂等取/建团队钱包，recordTransaction 写一笔 purchase+grant 流水并原子更新余额。
// 不写平行的积分变更路径——与 F02（用户手动上分，apps/web/app/api/admin/users/[id]/credit/route.ts）
// 共用同一套仓储函数，只是 wallet scope 不同；两个路由的加固必须保持同步。
//
// review 加固（PR #177 review，四点，与 F02 对齐）：
// 1. 幂等：SELECT-then-INSERT 的 check-then-act 在并发下会双双查空、双双入账。改用
//    recordTransactionIdempotent（单事务 INSERT ... ON CONFLICT (wallet_id, label) DO NOTHING，
//    只有抢到唯一流水的请求才更新余额），配合 019 迁移的部分唯一索引做数据库级兜底。
// 2. 金额：非整数（如 1.9）此前会被 Math.trunc 静默截断成 1 且没有任何反馈；改为显式拒绝
//    非整数，并加单次上限，与 F02 一致，防止注入任意大额。
// 3. 审计：把执行操作的 SysAdmin（gate.user.id + email）写进 description，financial action
//    必须可追溯到具体操作者。
// 4. note 长度上限 200 字符，防止无界输入写入 description。
const NOTE_MAX_LEN = 200;
const MANUAL_CREDIT_MAX_AMOUNT = 100_000;

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
  // 非整数（如 1.9）此前会被 Math.trunc 静默截断成 1，客户端却显示"已提交 1.9"式的误导；
  // 改为拒绝非整数，而不是悄悄截断后没有任何反馈（与 F02 一致）。
  const rawAmount = Number(body.amount);
  if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
    return NextResponse.json({ errors: { amount: "增加额度必须是大于 0 的整数" } }, { status: 400 });
  }
  if (rawAmount > MANUAL_CREDIT_MAX_AMOUNT) {
    return NextResponse.json(
      { errors: { amount: `单次增加额度不能超过 ${MANUAL_CREDIT_MAX_AMOUNT}` } },
      { status: 400 }
    );
  }
  const amount = rawAmount;
  const note = String(body.note ?? "").trim().slice(0, NOTE_MAX_LEN);

  // 幂等 key：优先取客户端头（每次提交生成一个，双击/重试会带同一个值）；
  // 没带 key 的调用方（如直接打 API 的越权测试）视为各自独立请求，不做查重。
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();

  const wallet = await getOrCreateTeamWallet(teamId);
  const label = idempotencyKey ? `Admin grant · idem:${idempotencyKey}` : "Admin grant";

  const operator = `${gate.user.email} (uid:${gate.user.id})`;
  const description = note
    ? `管理员手动上分 · 操作人 ${operator} · ${note}`
    : `管理员手动上分 · 操作人 ${operator}`;

  if (idempotencyKey) {
    const result = await recordTransactionIdempotent(wallet.id, {
      kind: "purchase",
      amount,
      grant: true,
      label,
      description,
    });
    if (result.idempotent) {
      const current = await getOrCreateTeamWallet(teamId);
      return NextResponse.json({ wallet: { balance: Number(current.balance) }, idempotent: true });
    }
  } else {
    await recordTransaction(wallet.id, {
      kind: "purchase",
      amount,
      grant: true,
      label,
      description,
    });
  }

  const updated = await getOrCreateTeamWallet(teamId);
  return NextResponse.json({ wallet: { balance: Number(updated.balance) } });
}
