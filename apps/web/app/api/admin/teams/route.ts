import { NextResponse } from "next/server";
import { listAdminTeams } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-002 — 后台团队管理列表 API（F03，真实 DB，CAP-DATA）。
// GET /api/admin/teams?q=&page=&pageSize= 分页/按名称搜索团队；每行含名称/类型/成员数/Credit 余额
// （真实聚合，Credit 余额来自该团队的 credit_wallets，无钱包则 0）。
// 越权（未登录/非 SysAdmin）分别 401/403，与 F01 门控、F02 用户管理 API 同一套判定复用。
export async function GET(req: Request) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(params.get("pageSize") ?? "10") || 10;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const { teams, total } = await listAdminTeams({ q, page, pageSize });

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      teamType: t.team_type,
      memberCount: Number(t.member_count),
      creditBalance: Number(t.credit_balance),
      createdAt: t.created_at,
    })),
    total,
    page,
    pageSize,
  });
}
