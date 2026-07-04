import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { createRoom, listVisibleRooms, getMembership, listFavoriteRoomIds, type RoomVisibility } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? undefined;
  const favoriteIds = await listFavoriteRoomIds(user.id);
  let rooms = await listVisibleRooms(user.id, q);
  // uc-rr-004：Favorites 筛选，只返回当前用户已收藏的房间
  // bigint 列经 pg 驱动可能回传为字符串，统一转 String 再比较，避免类型不一致误判
  if (params.get("favorite") === "1") {
    const favSet = new Set(favoriteIds.map(String));
    rooms = rooms.filter((r) => favSet.has(String(r.id)));
  }
  return NextResponse.json({ rooms, favoriteIds });
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
    } else {
      // uc-rr-002：未显式传 teamId 时回落到当前团队上下文（cookie），
      // 让 UI 建的 team 可见房间真正归属团队、对同团队成员可发现。
      // cookie 过期/不再是成员时静默回落为个人房间（team_id 为空的现有模型不变）。
      const cookieTeam = Number(cookies().get(CURRENT_TEAM_COOKIE)?.value);
      if (Number.isFinite(cookieTeam) && (await getMembership(cookieTeam, user.id))) {
        teamId = cookieTeam;
      }
    }
    const room = await createRoom(name, user.id, visibility, teamId);
    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
