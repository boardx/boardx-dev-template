import { NextResponse } from "next/server";
import { setAiStoreItemFeatured } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-004 — 官方精选切换（F05）：
//   featured: true  → 设为官方精选
//   featured: false → 取消官方精选
// 安全加固（对齐 F04 review 加固模式 + AGENTS.md 对 #173 的提醒）：
// 1. 服务端强制 requireSysAdmin()，非管理员 401/403，不信任前端按钮的可见性控制。
// 2. 切换只对 scope=platform 且 status=approved 的项目生效，用
//    `UPDATE ... WHERE scope='platform' AND status='approved'` 一步完成校验+写入，
//    避免"先 SELECT 校验再 UPDATE"的 TOCTOU（批准状态在此期间被并发撤回/拒绝）。
// 3. 幂等：目标值与当前值相同的重复提交（双击/网络重试）直接返回当前行，不报错。
// 4. 未命中（不存在 / 非 platform / 非 approved，比如已被撤回到 pending）→ 409，
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

  const body = (await req.json().catch(() => ({}))) as { featured?: unknown };
  if (typeof body.featured !== "boolean") {
    return NextResponse.json({ error: "无效的精选状态" }, { status: 400 });
  }

  const result = await setAiStoreItemFeatured(id, body.featured);
  if (!result) {
    return NextResponse.json(
      { error: "该项目当前不是已批准状态，或状态已被其他管理员更新，请刷新后重试" },
      { status: 409 }
    );
  }

  return NextResponse.json({ item: result.item, idempotent: result.idempotent });
}
