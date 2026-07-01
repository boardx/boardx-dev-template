// apps/web/app/api/ava/threads/[id]/route.ts — 单个 AVA 线程详情（P9 F01）
//
// GET /api/ava/threads/:id — 线程 + 历史消息（仅本人线程可访问）。
import { NextResponse } from "next/server";
import { getAvaThread, listAvaMessages } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });

  const thread = await getAvaThread(threadId);
  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const messages = await listAvaMessages(threadId);
  return NextResponse.json({ thread, messages });
}
