import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// p8:F02 — 客户端拿这个 URL 去连 F01 的 collab-gateway.mjs 传输层。不做鉴权：
// URL 本身不是敏感信息（网关自己的 upgrade 握手才是真正的鉴权点，见
// collab-gateway.mjs 的 isAuthenticated），这里加一层登录校验只是重复劳动。
//
// 生产部署（HTTPS + 反代）：裸 `ws://host:3001` 会被浏览器以混合内容拦截，且
// 3001 通常不对公网开放。设 COLLAB_WS_PUBLIC_URL（如 wss://devapp.boardx.us/api/collab/ws，
// 反代把 /api/collab/ws* 转发到网关 :3001）即整体覆盖；未设置时保持原开发行为：
// 按请求协议推导 ws/wss + 直连端口。
export async function GET(req: Request) {
  const publicUrl = process.env.COLLAB_WS_PUBLIC_URL;
  if (publicUrl) {
    return NextResponse.json({ wsUrl: publicUrl });
  }
  const url = new URL(req.url);
  const host = url.hostname || "localhost";
  const port = process.env.COLLAB_WS_PORT ?? "3001";
  const scheme = url.protocol === "https:" ? "wss" : "ws";
  return NextResponse.json({ wsUrl: `${scheme}://${host}:${port}/api/collab/ws` });
}
