// apps/web/app/api/ava/threads/[id]/share/route.ts — P9 F04 AVA thread share controls
import { NextResponse } from "next/server";
import {
  disableAvaThreadShare,
  enableAvaThreadShare,
  getAvaThread,
  getAvaThreadShare,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseThreadId(raw: string): number | undefined {
  const id = Number(raw);
  return Number.isFinite(id) ? id : undefined;
}

async function requireOwnedThread(rawId: string) {
  const user = await currentUser();
  if (!user) return { response: NextResponse.json({ error: "未登录" }, { status: 401 }) };

  const threadId = parseThreadId(rawId);
  if (threadId == null) {
    return { response: NextResponse.json({ error: "无效的线程 id" }, { status: 400 }) };
  }

  const thread = await getAvaThread(threadId);
  if (!thread || thread.user_id !== user.id) {
    return { response: NextResponse.json({ error: "线程不存在" }, { status: 404 }) };
  }
  return { threadId };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const checked = await requireOwnedThread(params.id);
  if ("response" in checked) return checked.response;
  const share = await getAvaThreadShare(checked.threadId);
  return NextResponse.json({ share: share ?? null });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const checked = await requireOwnedThread(params.id);
    if ("response" in checked) return checked.response;
    const share = await enableAvaThreadShare(checked.threadId);
    return NextResponse.json({ share }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const checked = await requireOwnedThread(params.id);
    if ("response" in checked) return checked.response;
    const share = await disableAvaThreadShare(checked.threadId);
    return NextResponse.json({ share: share ?? null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
