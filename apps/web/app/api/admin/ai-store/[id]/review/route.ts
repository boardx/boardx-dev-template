import { NextResponse } from "next/server";
import { setAiStoreItemReviewStatus, type AiStoreReviewAction } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ACTIONS: AiStoreReviewAction[] = ["approve", "reject", "revoke"];

// uc-admin-003 — 平台审核状态切换（F04）：
//   approve: pending → approved（批准，发布到平台）
//   reject:  pending → rejected（拒绝）
//   revoke:  approved → pending（撤回到待审核）
// 安全加固（对齐 F02/F03 review 加固模式 + AGENTS.md 对 #173 的提醒）：
// 1. 服务端强制 requireSysAdmin()，非管理员 401/403，不信任前端按钮的可见性控制。
// 2. 状态转移在 packages/data 层用 `UPDATE ... WHERE status = <期望前置状态>` 做原子乐观锁，
//    不是"先 SELECT 再 UPDATE"两步（那样两个管理员同时点击会有 TOCTOU 竞态）。
// 3. 幂等：同一个已经生效的操作重放（双击/网络重试）直接返回当前状态，不报错、不二次转移。
// 4. 前置状态不符（比如另一个管理员已经处理、或对象已被删除、或根本不是 platform scope）→ 409/404，
//    不能悄悄"假装成功"掩盖并发覆盖。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "无效的项目 ID" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  const actionRaw = String(body.action ?? "");
  if (!VALID_ACTIONS.includes(actionRaw as AiStoreReviewAction)) {
    return NextResponse.json({ error: "无效的审核操作" }, { status: 400 });
  }
  const action = actionRaw as AiStoreReviewAction;

  const result = await setAiStoreItemReviewStatus(id, action);
  if (!result) {
    return NextResponse.json(
      { error: "状态已被其他管理员更新或对象不可审核，请刷新后重试" },
      { status: 409 }
    );
  }

  return NextResponse.json({ item: result.item, idempotent: result.idempotent });
}
