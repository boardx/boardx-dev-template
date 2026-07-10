import { NextResponse } from "next/server";
import { canViewRoom, getReadyRoomFile, getRoom, resolveRoomId } from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/rooms/:id/files/:fileId/preview — 签发预览用的临时签名 URL（短期过期，默认 60s）。
// 契约缺口②（issue L10 显式归属本 feature，与 F09 邀请令牌过期是不同域）：签名 URL 会过期，
// 前端预览失败后展示过期提示文案，点击"刷新"重新调用本接口即可换取新的签名 URL——
// 本接口幂等可重复调用，每次都签发一个全新的、独立过期计时的 URL。
export async function GET(req: Request, { params }: { params: { id: string; fileId: string } }) {
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

    // expiresInSeconds 可选覆盖（仅用于 e2e 制造"签名 URL 已过期"的确定性场景，
    // 与 uc-rr-009 的 expireRoomInvite 思路一致——用真实短过期时间而非 mock，
    // 断言的是真实签名 URL 过期后前端展示的过期提示 + 刷新交互）。默认 60s。
    const url = new URL(req.url);
    const override = Number(url.searchParams.get("expiresInSeconds"));
    const expiresInSeconds = Number.isFinite(override) && override > 0 ? Math.min(override, 60) : 60;

    const previewUrl = await presignGetUrl(file.storage_path, expiresInSeconds);
    return NextResponse.json({ previewUrl, fileName: file.file_name, expiresInSeconds });
  } catch (err) {
    console.error("[rooms/files/:fileId/preview] 操作失败:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
