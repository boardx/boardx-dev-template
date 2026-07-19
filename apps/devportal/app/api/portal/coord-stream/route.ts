// portal 数据接入层 — GET /api/portal/coord-stream（p29/F09）
// 给已登录的页面签发 RepoHub WS 的一次性 ticket（60s）。
// 服务端持 COORD_API_TOKEN（Pages 加密 secret）向 gateway 换 ticket；
// 浏览器只拿到 ticket + ws_url，长期 token 绝不下发浏览器。
//
// p30/F07 修复：本路由建于 F09（Access-only 时代），只认 accessUser；F02 引入
// OAuth session 灰度后，纯 OAuth 登录（无 Access）的用户打这里恒 401 →
// portalFetch 的 #588 语义把 401 当「Access 会话过期」触发整页 reload——
// enroll 向导订阅 useCoordStream 时会被这个误判打断（e2e 复现：点击即触发
// 隐式整页刷新，导致后续交互卡死）。改用 getSessionUser（OAuth 优先、Access
// 兼容回退），与 middleware.ts 的会话判定口径统一。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const UPSTREAM_TIMEOUT_MS = 5_000;

export async function GET(req: Request) {
  const user = await getSessionUser(req.headers);
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
