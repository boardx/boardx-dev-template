import { NextResponse } from "next/server";
import { findTransactionByLabel, getOrCreatePersonalWallet, getUserById, recordTransaction } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-001 — 后台为用户手动增加个人 Credit（F02）。
// 复用 p14 的 credit_wallets/credit_transactions 仓储（packages/data/src/credits.ts）：
// getOrCreatePersonalWallet 幂等取/建个人钱包，recordTransaction 写一笔 purchase+grant 流水并原子更新余额。
// 与 F03（团队手动上分，apps/web/app/api/admin/teams/[id]/credit/route.ts）共用同一套仓储函数，
// 只是 wallet scope 不同（personal vs team）；同样的三点加固原样复用：
// 1. 幂等：客户端每次打开弹窗生成一个 Idempotency-Key（uuid），编码进流水的 label 一并落库；
//    重放/重复点击带同一 key 命中已有流水就直接返回，不二次入账。
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

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { amount?: unknown; note?: unknown };
  // review 加固（低严重度）：非整数（如 1.9）此前会被 Math.trunc 静默截断成 1，客户端却显示
  // "已提交 1.9"式的误导；改为拒绝非整数，而不是悄悄截断后没有任何反馈。
  const rawAmount = Number(body.amount);
  if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
    return NextResponse.json({ errors: { amount: "增加额度必须是大于 0 的整数" } }, { status: 400 });
  }
  const amount = rawAmount;
  const note = String(body.note ?? "").trim().slice(0, NOTE_MAX_LEN);

  // 幂等 key：优先取客户端头（每次提交生成一个，双击/重试会带同一个值）；
  // 没带 key 的调用方（如直接打 API 的越权测试）视为各自独立请求，不做查重。
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();

  const wallet = await getOrCreatePersonalWallet(userId);
  const label = idempotencyKey ? `Admin grant · idem:${idempotencyKey}` : "Admin grant";

  if (idempotencyKey) {
    const existing = await findTransactionByLabel(wallet.id, label);
    if (existing) {
      // 命中同一幂等 key 的既有流水：视为重放/双击，直接返回当前余额，不重复入账。
      const current = await getOrCreatePersonalWallet(userId);
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

  const updated = await getOrCreatePersonalWallet(userId);
  return NextResponse.json({ wallet: { balance: Number(updated.balance) } });
}
