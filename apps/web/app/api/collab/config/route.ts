import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// p8:F02 — 客户端拿这个 URL 去连 F01 的 collab-gateway.mjs 传输层。不做鉴权：
// URL 本身不是敏感信息（网关自己的 upgrade 握手才是真正的鉴权点，见
// collab-gateway.mjs 的 isAuthenticated），这里加一层登录校验只是重复劳动。
export async function GET(req: Request) {
  const port = process.env.COLLAB_WS_PORT ?? "3001";
  const host = new URL(req.url).hostname || "localhost";
  return NextResponse.json({ wsUrl: `ws://${host}:${port}/api/collab/ws` });
}
