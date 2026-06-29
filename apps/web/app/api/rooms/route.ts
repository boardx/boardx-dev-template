import { NextResponse } from "next/server";
import { createRoom, listVisibleRooms, getMembership, type RoomVisibility } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return NextResponse.json({ rooms: await listVisibleRooms(user.id, q) });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as { name?: unknown; visibility?: unknown; teamId?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ errors: { name: "房间名不能为空" } }, { status: 400 });
    const visibility: RoomVisibility = body.visibility === "team" ? "team" : "private";
    let teamId: number | null = null;
    if (body.teamId != null) {
      teamId = Number(body.teamId);
      // 归属团队需是该团队成员
      if (!(await getMembership(teamId, user.id))) {
        return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
      }
    }
    const room = await createRoom(name, user.id, visibility, teamId);
    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
