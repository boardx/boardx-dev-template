import { NextResponse } from "next/server";
import {
  canViewRoom,
  createPresentationRevision,
  getPresentationArtifact,
  getRoomChat,
  markPresentationRevisionError,
  resolveRoomId,
} from "@repo/data";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PresentationRevisionJobData {
  revisionId: string;
  artifactId: string;
  kind: "page";
  pageN: number;
  instructions: string;
  currentTitle: string;
  currentSlides: unknown;
}

// POST /api/rooms/:id/chats/:chatId/presentations/artifacts/:artifactId/optimize-page —
// uc-presentations-002 单页优化：全屏预览点「优化本页」输入要求，仅重生成该页并原位替换，
// 其余页不受影响；异步处理，成功后原地替换该页；失败不破坏原可查看结果（同 revisions 路由）。
export async function POST(
  req: Request,
  { params }: { params: { id: string; chatId: string; artifactId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const roomId = await resolveRoomId(params.id);
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const chat = await getRoomChat(Number(params.chatId));
    if (!chat || Number(chat.room_id) !== roomId) {
      return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    }
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "只读线程不可优化" }, { status: 403 });
    }

    const artifact = await getPresentationArtifact(params.artifactId);
    if (!artifact || artifact.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }
    if (artifact.creator_user_id !== user.id) {
      return NextResponse.json({ error: "无权优化此制品" }, { status: 403 });
    }
    if (artifact.status !== "ready") {
      return NextResponse.json({ error: "仅已生成完成的演示可优化" }, { status: 409 });
    }

    const body = (await req.json().catch(() => ({}))) as { pageN?: unknown; instructions?: unknown };
    const pageN = Number(body.pageN);
    const instructions = String(body.instructions ?? "").trim();
    if (!instructions) {
      return NextResponse.json({ errors: { instructions: "请描述优化要求" } }, { status: 400 });
    }
    const slides = artifact.slides ?? [];
    if (!Number.isFinite(pageN) || !slides.some((s) => s.n === pageN)) {
      return NextResponse.json({ errors: { pageN: "目标页不存在" } }, { status: 400 });
    }

    const revisionId = `pr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const revision = await createPresentationRevision({
      id: revisionId,
      artifactId: artifact.id,
      kind: "page",
      pageN,
      instructions,
      creatorUserId: user.id,
    });

    try {
      const queue = makeQueue<PresentationRevisionJobData>(QUEUE_NAMES.presentationRevision);
      await queue.add("optimize-page", {
        revisionId,
        artifactId: artifact.id,
        kind: "page",
        pageN,
        instructions,
        currentTitle: artifact.title ?? artifact.topic,
        currentSlides: slides,
      });
      await queue.close();
    } catch (err) {
      console.error(`presentation-revision(page) 入队失败（revision=${revisionId}）：`, err);
      await markPresentationRevisionError(revisionId, "优化任务入队失败，请重试");
      return NextResponse.json(
        { revision: { ...revision, status: "error" as const, error_message: "优化任务入队失败，请重试" } },
        { status: 202 }
      );
    }

    return NextResponse.json({ revision }, { status: 202 });
  } catch (err) {
    console.error("POST presentations/optimize-page 失败：", err);
    return NextResponse.json({ error: "优化请求处理失败，请重试" }, { status: 500 });
  }
}
