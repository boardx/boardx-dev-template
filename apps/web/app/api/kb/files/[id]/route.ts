import { NextResponse } from "next/server";
import { deleteKbFile, getAccessibleKbFile } from "@repo/data";
import { deleteObject } from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-kb-003-delete-file — 删除知识库文件（p10-F03）。
// DELETE /api/kb/files/:id：仅文件的有权访问者（getAccessibleKbFile 同下载路由的权限口径，
// personal/agent/tool 限 owner；team 限同 team 成员）可删；无权限/不存在统一 404（不泄露存在性，
// 与下载路由一致）。级联顺序：先删对象存储，成功后再删 DB 记录——避免对象删除失败却已丢了 DB 记录
// 导致悬挂引用；DB 记录一旦删除，该文件立刻不再出现在列表/检索中（F04 未实现向量索引，
// 检索天然只查 kb_files，删记录即等价于不再被命中）。
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const file = await getAccessibleKbFile(params.id, user.id);
    if (!file) return NextResponse.json({ error: "文件不存在或无权访问" }, { status: 404 });

    try {
      await deleteObject(file.object_key);
    } catch (err) {
      return NextResponse.json({ error: `对象存储删除失败：${String(err)}` }, { status: 502 });
    }

    await deleteKbFile(file.id);

    return NextResponse.json({ ok: true, id: file.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
