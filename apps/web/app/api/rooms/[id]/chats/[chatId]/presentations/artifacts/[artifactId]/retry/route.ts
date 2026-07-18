import { NextResponse } from "next/server";
import {
  canViewRoom,
  getPresentationArtifact,
  getRoomChat,
  markPresentationArtifactError,
  resetPresentationArtifactForRetry,
  resolveRoomId,
  type PresentationSource,
} from "@repo/data";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PresentationJobData {
  artifactId: string;
  roomId: number;
  chatId: number;
  topic: string;
  source: PresentationSource;
  instructions: string;
  pages: number;
  style: string;
  sourceLabel: string;
}

const SOURCE_LABEL: Record<PresentationSource, string> = {
  current_chat: "当前聊天",
  room_files: "房间文件",
  instructions: "说明文本",
};

// POST /api/rooms/:id/chats/:chatId/presentations/artifacts/:artifactId/retry —
// uc-presentations-001 失败重试。仅失败态制品可重试；重置为 queued 并重新入队，
// 复用原 topic/source/instructions/pages/style。
export async function POST(
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
    // 与 generate 一致：只读线程（非创建者）不可重试生成。
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "只读线程不可生成" }, { status: 403 });
    }

    const existing = await getPresentationArtifact(params.artifactId);
    if (!existing || existing.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }
    if (existing.status !== "error") {
      return NextResponse.json({ error: "仅失败的制品可重试" }, { status: 400 });
    }

    const artifact = await resetPresentationArtifactForRetry(params.artifactId);
    if (!artifact) return NextResponse.json({ error: "制品不存在" }, { status: 404 });

    try {
      const queue = makeQueue<PresentationJobData>(QUEUE_NAMES.presentationGeneration);
      await queue.add("generate", {
        artifactId: artifact.id,
        roomId,
        chatId: chat.id,
        topic: artifact.topic,
        source: artifact.source,
        instructions: artifact.instructions,
        pages: artifact.pages,
        style: artifact.style,
        sourceLabel: SOURCE_LABEL[artifact.source],
      });
      await queue.close();
    } catch (err) {
      // 同 generate：入队失败不能让制品卡在 queued 出不来，立刻回退 error 保留可重试路径。
      console.error(`presentation-generation 重试入队失败（artifact=${artifact.id}）：`, err);
      await markPresentationArtifactError(artifact.id, "生成任务入队失败，请重试");
      return NextResponse.json(
        { artifact: { ...artifact, status: "error" as const, error_message: "生成任务入队失败，请重试" } },
        { status: 202 }
      );
    }

    return NextResponse.json({ artifact }, { status: 202 });
  } catch (err) {
    console.error("POST presentations/retry 失败：", err);
    return NextResponse.json({ error: "重试请求处理失败，请重试" }, { status: 500 });
  }
}
