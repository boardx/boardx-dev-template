// coordination dashboard — GET /api/admin/coordination/status
// 服务端代理 coord-service 的公开 GET /status（Cloudflare Worker，见 packages/coord-service
// src/routes/status.ts）。为什么要代理而不是浏览器直连：COORD_SERVICE_URL 留在服务端
// 环境变量里（不必暴露给客户端 bundle），也顺带避开 CORS。上游端点本身公开只读，
// 这里仍套 SysAdmin 门禁，与本 dashboard 其余路由保持同一暴露面。
//
// ADR-009 后这是人类看协调实时状态的主要窗口——GitHub 上不再有协调评论可看。
// COORD_SERVICE_URL 未配置时返回 configured:false（200），让 UI 展示"未接线"
// 状态而不是笼统报错——未配置是合法的部署中间态，不是故障。
import { NextResponse } from "next/server";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;

export async function GET() {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const baseUrl = process.env["COORD_SERVICE_URL"];
  if (!baseUrl) {
    return NextResponse.json({ configured: false });
  }

  try {
    const res = await fetch(`${baseUrl}/status`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "coord_service_unavailable", upstream_status: res.status }, { status: 502 });
    }
    const body = (await res.json()) as Record<string, unknown>;
    return NextResponse.json({ configured: true, ...body });
  } catch (err) {
    console.error("[admin/coordination/status] coord-service fetch failed", err);
    return NextResponse.json({ error: "coord_service_unavailable" }, { status: 502 });
  }
}
