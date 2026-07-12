import { NextResponse } from "next/server";
import {
  listVisibleRooms,
  listBoardsInRoom,
  listUserTeams,
  type Room,
  type Board,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/search?q=<keyword>
//  - 鉴权：未登录 → 401（前端据此跳 /login）。
//  - 返回调用者「有权限访问」的资源，按类型分组：{ boards, rooms, teams }。
//  - 实现：在内存中聚合既有仓储（不新增 SQL / 不动 data 层）：
//      rooms = listVisibleRooms(userId, q)      —— 已含权限过滤
//      boards = 对每个可见 room 调 listBoardsInRoom(roomId, q) 后扁平合并
//      teams  = listUserTeams(userId) 再按名称客户端过滤
//  - 空 q 返回空分组（前端展示「输入关键词」提示，不泄露全量资源）。
//  注：UC 提到的 Templates / Agents / Tools / Threads 当前没有对应仓储，
//      暂以空数组占位（stub），待相应数据层就绪后接入。
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  // 空查询：返回空分组，由前端引导用户输入关键词。
  if (!q) {
    return NextResponse.json({ boards: [], rooms: [], teams: [] });
  }

  try {
    const rooms: Room[] = await listVisibleRooms(user.id, q);

    // boards：只在「可见 room」范围内搜，天然受权限约束（不泄露无权资源）。
    // 用全部可见 room（不带 q）作为搜索域，再按 q 过滤各 room 内白板，
    // 覆盖「room 名不匹配但 board 名匹配」的情况。
    const visibleRooms: Room[] = await listVisibleRooms(user.id);
    const roomNameById = new Map<number, string>(visibleRooms.map((r) => [r.id, r.name]));
    const boardLists = await Promise.all(
      visibleRooms.map((r) => listBoardsInRoom(r.id, q)),
    );
    const boards = boardLists.flat().map((b: Board) => ({
      id: b.id,
      public_id: b.public_id,
      name: b.name,
      room_id: b.room_id,
      room_name: roomNameById.get(b.room_id) ?? null,
      team_id: b.team_id,
      owner_user_id: b.owner_user_id,
      created_at: b.created_at,
    }));

    const teamsAll = await listUserTeams(user.id);
    const needle = q.toLowerCase();
    const teams = teamsAll
      .filter((t) => t.name.toLowerCase().includes(needle))
      .map((t) => ({ id: t.id, name: t.name, role: t.role, created_at: t.created_at }));

    return NextResponse.json({
      boards,
      rooms: rooms.map((r) => ({
        id: r.id,
        public_id: r.public_id,
        name: r.name,
        visibility: r.visibility,
        team_id: r.team_id,
        created_at: r.created_at,
      })),
      teams,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
