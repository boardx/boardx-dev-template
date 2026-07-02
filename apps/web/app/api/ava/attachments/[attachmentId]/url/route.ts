// apps/web/app/api/ava/attachments/[attachmentId]/url/route.ts — 附件预览/缩略图直链（P9 F08）
//
// GET：composer 预览条 / 聊天历史里给图片 <img src> 或文件下载链接使用的临时签名 URL。
// 鉴权：附件必须属于当前用户，且其所属线程的 team_id 匹配当前团队上下文（同 #153 修复口径），
// 防止跨团队/跨用户枚举 attachmentId 拿到直链。
import { NextResponse } from "next/server";
import { getAvaAttachment, getAvaThread } from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentUser, currentTeamId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { attachmentId: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const attachment = await getAvaAttachment(params.attachmentId);
  if (!attachment || attachment.owner_user_id !== user.id) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }

  const thread = await getAvaThread(attachment.thread_id);
  if (!thread || thread.user_id !== user.id || thread.team_id !== currentTeamId()) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }

  const url = await presignGetUrl(attachment.object_key);
  return NextResponse.json({ url });
}
