import { NextResponse } from "next/server";
import { getBoardAccessRole } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// p8:F01 收尾 — collab-gateway.mjs 在 WS upgrade 时调这个端点做鉴权+鉴权限
// 二合一校验：网关不直连 DB，复用主 app 现成的 session + board 访问权判定
// （跟 GET /api/auth/session 同一模式，只是多校验一层"对这个 boardId 有没有权限"）。
// 未登录 401；登录但对该 board 无权限（非 owner/编辑者/可见 viewer）403；
// 有权限 200。网关只关心状态码是否 2xx，不解析 body。
export async function GET(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(new URL(req.url).searchParams.get("boardId"));
    if (!Number.isFinite(boardId)) return NextResponse.json({ error: "invalid boardId" }, { status: 400 });
    const role = await getBoardAccessRole(boardId, user.id);
    if (!role) return NextResponse.json({ error: "无权限访问该 board" }, { status: 403 });
    return NextResponse.json({ ok: true, role });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
