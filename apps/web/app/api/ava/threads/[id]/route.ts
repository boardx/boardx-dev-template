// apps/web/app/api/ava/threads/[id]/route.ts — 单个 AVA 线程详情（P9 F01）
//
// GET    /api/ava/threads/:id — 线程 + 历史消息（仅本人当前团队上下文可访问）。
// PATCH  /api/ava/threads/:id — 重命名当前团队上下文内的本人线程。
// DELETE /api/ava/threads/:id — 删除当前团队上下文内的本人线程（消息级联删除）。
import { NextResponse } from "next/server";
import { deleteAvaThread, getAvaThread, listAvaMessages, renameAvaThread } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isThreadInCurrentContext(
  thread: { user_id: number | string; team_id: number | string | null },
  userId: number,
  teamId: number | null
): boolean {
  const sameUser = String(thread.user_id) === String(userId);
  const sameTeam = thread.team_id == null ? teamId == null : teamId != null && String(thread.team_id) === String(teamId);
  return sameUser && sameTeam;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });

  const thread = await getAvaThread(threadId);
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return NextResponse.json({ error: "线程不存在" }, { status: 404 });
  }

  const messages = await listAvaMessages(threadId);
  return NextResponse.json({ thread, messages });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const threadId = Number(params.id);
    if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = String(body.title ?? "").trim().replace(/\s+/g, " ");
    if (!title) return NextResponse.json({ errors: { title: "标题不能为空" } }, { status: 400 });
    if (title.length > 120) return NextResponse.json({ errors: { title: "标题不能超过 120 个字符" } }, { status: 400 });
    const thread = await renameAvaThread(threadId, user.id, currentTeamId(), title);
    if (!thread) return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    return NextResponse.json({ thread });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const threadId = Number(params.id);
    if (!Number.isFinite(threadId)) return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
    const deleted = await deleteAvaThread(threadId, user.id, currentTeamId());
    if (!deleted) return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
