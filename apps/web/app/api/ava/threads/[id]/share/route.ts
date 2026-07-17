// apps/web/app/api/ava/threads/[id]/share/route.ts — P9 F04 AVA thread share controls
import { NextResponse } from "next/server";
import {
  disableAvaThreadShare,
  enableAvaThreadShare,
  getAvaThread,
  getAvaThreadShare,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseThreadId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

type OwnedThreadResult =
  | { ok: true; threadId: number }
  | { ok: false; response: NextResponse };

async function requireOwnedThread(rawId: string): Promise<OwnedThreadResult> {
  const user = await currentUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "未登录" }, { status: 401 }) };

  const threadId = parseThreadId(rawId);
  if (threadId == null) {
    return { ok: false, response: NextResponse.json({ error: "无效的线程 id" }, { status: 400 }) };
  }

  const thread = await getAvaThread(threadId);
  // 鉴权同时校验 user_id 与 team_id：修复 #153（跨团队用可枚举的线程 id 越权访问分享设置）。
  if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
    return { ok: false, response: NextResponse.json({ error: "线程不存在" }, { status: 404 }) };
  }
  return { ok: true, threadId };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const checked = await requireOwnedThread(params.id);
  if (!checked.ok) return checked.response;
  const share = await getAvaThreadShare(checked.threadId);
  return NextResponse.json({ share: share ?? null });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const checked = await requireOwnedThread(params.id);
    if (!checked.ok) return checked.response;
    const share = await enableAvaThreadShare(checked.threadId);
    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const checked = await requireOwnedThread(params.id);
    if (!checked.ok) return checked.response;
    const share = await disableAvaThreadShare(checked.threadId);
    return NextResponse.json({ share: share ?? null });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
