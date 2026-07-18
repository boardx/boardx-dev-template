// portal 数据接入层 — GET /api/portal/coord-stream（p29/F09）
// 给已过 Access 门禁的页面签发 RepoHub WS 的一次性 ticket（60s）。
// 服务端持 COORD_API_TOKEN（Pages 加密 secret）向 gateway 换 ticket；
// 浏览器只拿到 ticket + ws_url，长期 token 绝不下发浏览器。
import { NextResponse } from "next/server";
import { accessUser } from "@/lib/access";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;

export async function GET(req: Request) {
  const user = await accessUser(req.headers);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const gateway = process.env["COORD_GATEWAY_URL"];
  const token = process.env["COORD_API_TOKEN"];
  const repo = process.env["GITHUB_REPO"];
  if (!gateway || !token || !repo) {
    // 未接线是合法部署中间态（诚实降级）：客户端保持轮询兜底，不重试 WS
    return NextResponse.json({ configured: false });
  }

  try {
    const res = await fetch(`${gateway}/api/coord/repos/${repo}/stream-ticket`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { configured: true, error: `upstream_${res.status}` },
        { status: 502 },
      );
    }
    const body = (await res.json()) as { ticket: string; expires_at: string };
    return NextResponse.json({
      configured: true,
      ticket: body.ticket,
      expires_at: body.expires_at,
      ws_url: `${gateway.replace(/^http/, "ws")}/api/coord/repos/${repo}/stream`,
    });
  } catch (err) {
    console.warn("[portal/coord-stream] gateway ticket fetch failed", err);
    return NextResponse.json({ configured: true, error: "unreachable" }, { status: 502 });
  }
}
