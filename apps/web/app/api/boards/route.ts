import { NextResponse } from "next/server";
import { canViewRoom, getRoom, listBoardsInRoom, listRecentBoards } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/boards?roomId=&q=&scope=recent
//  - scope=recent：当前用户最近访问且仍可见的白板（按访问时间倒序）
//  - roomId：该房间内白板（需房间成员，否则 403）
//  可选 q 按名称过滤。
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const scope = url.searchParams.get("scope");
  const roomIdParam = url.searchParams.get("roomId");

  if (scope === "recent") {
    return NextResponse.json({ boards: await listRecentBoards(user.id, q) });
  }

  if (roomIdParam) {
    const roomId = Number(roomIdParam);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    return NextResponse.json({ boards: await listBoardsInRoom(roomId, q) });
  }

  return NextResponse.json({ error: "需要 roomId 或 scope=recent" }, { status: 400 });
}
