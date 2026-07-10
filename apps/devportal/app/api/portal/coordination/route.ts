// portal 数据接入层 — GET /api/portal/coordination（p23/F05 的 Cloudflare 版，#523 Track A）
// 代理 coord-service 公开 GET /status；门禁走 Cloudflare Access。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
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
    console.warn("[portal/coordination] coord-service fetch failed", err);
    return NextResponse.json({ error: "coord_service_unavailable" }, { status: 502 });
  }
}
