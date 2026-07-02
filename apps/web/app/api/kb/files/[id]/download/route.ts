import { NextResponse } from "next/server";
import { getAccessibleKbFile } from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const file = await getAccessibleKbFile(params.id, user.id);
    if (!file) return NextResponse.json({ error: "文件不存在或无权访问" }, { status: 404 });
    if (file.status !== "ready") {
      return NextResponse.json({ error: "文件仍在处理中，暂不能下载" }, { status: 409 });
    }

    const downloadUrl = await presignGetUrl(file.object_key);
    return NextResponse.json({ downloadUrl, fileName: file.name, expiresInSeconds: 300 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
