import { NextResponse } from "next/server";
import { canViewRoom, getRoomRole, listRoomSurveys, resolveRoomId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// p20/F08（uc-rr-007）：房间 Survey tab 只列本房间问卷（scope='room' 且 room_id 匹配），
// 不再嵌入 Team Surveys 全集——修正 uc-room-007 的 scope 丢失问题。
// 问卷本体（题型/答题/报告）不在这里处理，创建/编辑仍复用 apps/web/app/api/surveys 与
// apps/web/app/(app)/surveys 的 p13 既有实现，这里只负责"按房间过滤 + 权限判定"。

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = await resolveRoomId(params.id);
  if (!Number.isFinite(roomId)) return NextResponse.json({ error: "roomId 无效" }, { status: 400 });
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const role = await getRoomRole(roomId, user.id);
  const canManage = role === "owner" || role === "admin";
  const surveys = await listRoomSurveys(roomId);
  return NextResponse.json({
    myRole: role ?? null,
    canManage,
    surveys: surveys.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.is_active ? "active" : "paused",
      responses: Number(s.response_count ?? 0),
      updatedAt: s.updated_at,
      isOwner: Number(s.owner_user_id) === Number(user.id),
      shareUrl: `/survey/${s.id}/answer`,
    })),
  });
}
