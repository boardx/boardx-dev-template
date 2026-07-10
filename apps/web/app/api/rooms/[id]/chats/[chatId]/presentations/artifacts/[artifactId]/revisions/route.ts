import { NextResponse } from "next/server";
import {
  canViewRoom,
  createPresentationRevision,
  getPresentationArtifact,
  getRoomChat,
  listPresentationRevisionsByArtifact,
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
  kind: "plan";
  instructions: string;
  currentTitle: string;
  currentSlides: unknown;
}

// GET /api/rooms/:id/chats/:chatId/presentations/artifacts/:artifactId/revisions —
// 方案修订请求列表（供前端轮询处理态 → ready/error）。
// POST 同路径 — uc-presentations-002 方案层修订：在当前幻灯片基础上提修改要求（改结构/
// 受众/风格），异步得到更新方案；成功后原地替换制品的 title/slides，原可查看结果在处理
// 期间保持不变；修订失败不破坏原结果（只标记 revision 为 error）。
export async function GET(
  _req: Request,
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
    const artifact = await getPresentationArtifact(params.artifactId);
    if (!artifact || artifact.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }

    const revisions = await listPresentationRevisionsByArtifact(artifact.id);
    return NextResponse.json({ revisions });
  } catch (err) {
    console.error("GET presentations/revisions 失败：", err);
    return NextResponse.json({ error: "加载修订列表失败，请重试" }, { status: 500 });
  }
}

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
    // 与 generate/retry 一致：只读线程（非创建者）不可发起修订。创建者校验同时防止
    // 引用无权访问的制品（制品必须属于当前创建者可编辑的线程）。
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "只读线程不可修订" }, { status: 403 });
    }

    const artifact = await getPresentationArtifact(params.artifactId);
    if (!artifact || artifact.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }
    if (artifact.creator_user_id !== user.id) {
      return NextResponse.json({ error: "无权修订此制品" }, { status: 403 });
    }
    if (artifact.status !== "ready") {
      return NextResponse.json({ error: "仅已生成完成的演示可修订" }, { status: 409 });
    }

    const body = (await req.json().catch(() => ({}))) as { instructions?: unknown };
    const instructions = String(body.instructions ?? "").trim();
    if (!instructions) {
      return NextResponse.json({ errors: { instructions: "请描述修改要求" } }, { status: 400 });
    }

    const revisionId = `pr_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const revision = await createPresentationRevision({
      id: revisionId,
      artifactId: artifact.id,
      kind: "plan",
      instructions,
      creatorUserId: user.id,
    });

    try {
      const queue = makeQueue<PresentationRevisionJobData>(QUEUE_NAMES.presentationRevision);
      await queue.add("revise-plan", {
        revisionId,
        artifactId: artifact.id,
        kind: "plan",
        instructions,
        currentTitle: artifact.title ?? artifact.topic,
        currentSlides: artifact.slides ?? [],
      });
      await queue.close();
    } catch (err) {
      console.error(`presentation-revision 入队失败（revision=${revisionId}）：`, err);
      await markPresentationRevisionError(revisionId, "修订任务入队失败，请重试");
      return NextResponse.json(
        { revision: { ...revision, status: "error" as const, error_message: "修订任务入队失败，请重试" } },
        { status: 202 }
      );
    }

    return NextResponse.json({ revision }, { status: 202 });
  } catch (err) {
    console.error("POST presentations/revisions 失败：", err);
    return NextResponse.json({ error: "修订请求处理失败，请重试" }, { status: 500 });
  }
}
