import { NextResponse } from "next/server";
import { getKbFile, getMembership } from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-kb-002-download-file（p10-F02）。
// GET /api/kb/files/:id/download — 鉴权后 302 到短期有效（5 分钟）的对象存储预签名 URL，
// 不直接把对象存储直链/凭据暴露给前端（前端只拿到这个带鉴权检查的服务端 URL）。
// 权限：personal → 仅 owner；team → 仅同 team 成员；未 ready（processing/error）文件不可下载。

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const file = await getKbFile(params.id);
  if (!file) return NextResponse.json({ error: "文件不存在" }, { status: 404 });

  if (file.scope === "team") {
    if (file.team_id == null || !(await getMembership(file.team_id, user.id))) {
      return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
    }
  } else if (file.owner_user_id !== user.id) {
    return NextResponse.json({ error: "无权访问该文件" }, { status: 403 });
  }

  if (file.status !== "ready") {
    return NextResponse.json({ error: "文件仍在处理中，暂不可下载" }, { status: 409 });
  }

  const url = await presignGetUrl(file.object_key);
  return NextResponse.redirect(url, { status: 302 });
}
