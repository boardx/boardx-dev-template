import { NextResponse } from "next/server";
import {
  countBoardsInRoom,
  countRoomChats,
  countRoomFiles,
  countRoomSurveys,
  getRoom,
  isRoomOwner,
  resolveRoomId,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/delete-preview — p20/F06（uc-rr-005）Danger Zone 二次确认弹窗的
// 级联数量摘要。独立子路由而非塞进现有 GET/PATCH/DELETE，避免与 F11 在 route.ts 上
// 产生行级冲突。仅 owner 可查（与 DELETE 的权限判定一致：删除房间仅 owner）。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = await resolveRoomId(params.id);
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await isRoomOwner(roomId, user.id))) {
    return NextResponse.json({ error: "仅 owner 可删除" }, { status: 403 });
  }

  const [boards, chats, files, surveys] = await Promise.all([
    countBoardsInRoom(roomId),
    countRoomChats(roomId),
    countRoomFiles(roomId),
    countRoomSurveys(roomId),
  ]);

  return NextResponse.json({ roomName: room.name, boards, chats, files, surveys });
}
