import { NextResponse } from "next/server";
import { canManageRoom, canViewRoom, getReadyRoomFile, getRoom, resolveRoomId, softDeleteRoomFile } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/rooms/:id/files/:fileId — 软删房间文件（uc-rr-003 权限规则）。
// 删除权限 = 上传者本人 或 owner/admin；member 删他人文件 → 403（承接 F07 权限矩阵，
// 本 feature 补齐"admin 删他人文件"这一行断言）。软删后立即从列表/所有线程面板消失
// （listRoomFiles 只查 status='ready'）。
export async function DELETE(_req: Request, { params }: { params: { id: string; fileId: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const file = await getReadyRoomFile(roomId, params.fileId);
    if (!file) return NextResponse.json({ error: "文件不存在或已删除" }, { status: 404 });

    const isUploader = file.uploader_id === user.id;
    const isManager = await canManageRoom(roomId, user.id);
    if (!isUploader && !isManager) {
      return NextResponse.json({ error: "只有上传者本人或房间 owner/admin 可删除该文件" }, { status: 403 });
    }

    await softDeleteRoomFile(file.id);
    return NextResponse.json({ ok: true, id: file.id });
  } catch (err) {
    console.error("[rooms/files/:fileId] 操作失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
