// apps/web/app/api/ava/threads/route.ts — AVA 线程集合（P9 F01）
//
// GET  /api/ava/threads — 当前用户在当前团队上下文下的线程列表（最近更新在前，分页）。
// POST /api/ava/threads — 新建一个空线程（「新建聊天」按钮）；也可在发首条消息时由
//                          messages 路由隐式创建（未传 threadId 时）。
import { NextResponse } from "next/server";
import { createAvaThread, listAvaThreads, DEFAULT_AVA_THREAD_TITLE } from "@repo/data";
import { currentUser, currentTeamId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const reqUrl = new URL(req.url);
  const requestedLimit = Number(reqUrl.searchParams.get("limit") ?? "20");
  const requestedOffset = Number(reqUrl.searchParams.get("cursor") ?? "0");
  const pageSize = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 20;
  const offset = Number.isFinite(requestedOffset) ? Math.max(Math.trunc(requestedOffset), 0) : 0;
  const threads = await listAvaThreads(user.id, currentTeamId(), { limit: pageSize + 1, offset });
  const visibleThreads = threads.slice(0, pageSize);
  return NextResponse.json({
    threads: visibleThreads,
    hasMore: threads.length > pageSize,
    nextCursor: threads.length > pageSize ? String(offset + pageSize) : null,
  });
}

export async function POST() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const thread = await createAvaThread(user.id, currentTeamId(), DEFAULT_AVA_THREAD_TITLE);
    return NextResponse.json({ thread }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
