// apps/web/app/api/chatShare/[id]/route.ts — public read-only AVA shared thread endpoint
import { NextResponse } from "next/server";
import { getSharedAvaThread } from "@repo/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const threadId = Number(params.id);
  if (!Number.isFinite(threadId)) {
    return NextResponse.json({ error: "Invalid chat session" }, { status: 400 });
  }

  const shareToken = new URL(req.url).searchParams.get("shareToken") ?? "";
  if (!shareToken) {
    return NextResponse.json({ error: "Invalid chat session" }, { status: 400 });
  }

  const thread = await getSharedAvaThread(threadId, shareToken);
  if (!thread) {
    return NextResponse.json({ error: "Share link is unavailable" }, { status: 403 });
  }

  return NextResponse.json({ thread });
}
