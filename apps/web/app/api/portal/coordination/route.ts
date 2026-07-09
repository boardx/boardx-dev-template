// portal 数据接入层 — GET /api/portal/coordination（p23/F05）
// 服务端代理 coord-service 的公开 GET /status（完整 active_claims + recent_events），
// 与 admin/coordination/status 同一代理写法（COORD_SERVICE_URL 留服务端、避开 CORS），
// 但门禁不同：门户面向全体登录开发者，currentUser 登录即可，无需 SysAdmin——
// 上游端点本身公开只读，门户只是拓宽可见面，不增加写暴露。
// COORD_SERVICE_URL 未配置 → {configured:false}（200，合法部署中间态，前端渲染"未接线"）。
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

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
    console.error("[portal/coordination] coord-service fetch failed", err);
    return NextResponse.json({ error: "coord_service_unavailable" }, { status: 502 });
  }
}
