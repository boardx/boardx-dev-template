import { NextResponse } from "next/server";
import { listPlatformReviewItems } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-003 — 平台审核页列表 API（F04，真实 DB，CAP-DATA）。
// GET /api/admin/ai-store?status=&q=&page=&pageSize= 只返回 scope=platform 且状态在
// pending/approved 的项目（rejected/draft/published/personal/team 不进审核队列）。
// 越权（未登录/非 SysAdmin）分别 401/403，与 F01/F02/F03 同一套 requireSysAdmin() 判定复用。
export async function GET(req: Request) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const params = new URL(req.url).searchParams;
  const statusRaw = params.get("status") ?? "";
  const statusFilter = statusRaw === "pending" || statusRaw === "approved" ? statusRaw : "";
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(params.get("pageSize") ?? "20") || 20;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const { items, total, totalPages } = await listPlatformReviewItems({ status: statusFilter, q, page, pageSize });

  return NextResponse.json({ items, total, page, pageSize, totalPages });
}
