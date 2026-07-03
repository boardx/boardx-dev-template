import { NextResponse } from "next/server";
import { listFeaturedCandidateItems } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-004 — 官方精选页列表 API（F05，真实 DB，CAP-DATA）。
// GET /api/admin/ai-store/featured?featured=&q=&page=&pageSize= 只返回 scope=platform 且
// status=approved 的项目（F04 审核通过的集合），未通过审核的项目不出现在精选候选池。
// 越权（未登录/非 SysAdmin）分别 401/403，与 F01-F04 同一套 requireSysAdmin() 判定复用。
export async function GET(req: Request) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const params = new URL(req.url).searchParams;
  const featuredRaw = params.get("featured") ?? "";
  const featured = featuredRaw === "true" ? true : featuredRaw === "false" ? false : undefined;
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(params.get("pageSize") ?? "20") || 20;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const { items, total, totalPages } = await listFeaturedCandidateItems({ featured, q, page, pageSize });

  return NextResponse.json({ items, total, page, pageSize, totalPages });
}
