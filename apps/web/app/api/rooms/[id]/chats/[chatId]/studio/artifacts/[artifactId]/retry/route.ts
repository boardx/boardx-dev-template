import { NextResponse } from "next/server";
import { canViewRoom, getRoomChat, getStudioArtifact, resetStudioArtifactForRetry } from "@repo/data";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StudioJobData {
  artifactId: string;
  roomId: number;
  chatId: number;
  type: "audio" | "infographic" | "presentation";
  source: "room_files" | "current_chat";
  prompt: string;
  sourceLabel: string;
}

// POST /api/rooms/:id/chats/:chatId/studio/artifacts/:artifactId/retry — uc-studio-001 E3 重试。
// 仅失败态制品可重试；重置为 queued 并重新入队，复用原 type/source/prompt。
export async function POST(
  _req: Request,
  { params }: { params: { id: string; chatId: string; artifactId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const roomId = Number(params.id);
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const chat = await getRoomChat(Number(params.chatId));
    if (!chat || Number(chat.room_id) !== roomId) {
      return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    }

    const existing = await getStudioArtifact(params.artifactId);
    if (!existing || existing.chat_id !== chat.id) {
      return NextResponse.json({ error: "制品不存在" }, { status: 404 });
    }
    if (existing.status !== "error") {
      return NextResponse.json({ error: "仅失败的制品可重试" }, { status: 400 });
    }

    const artifact = await resetStudioArtifactForRetry(params.artifactId);
    if (!artifact) return NextResponse.json({ error: "制品不存在" }, { status: 404 });

    try {
      const queue = makeQueue<StudioJobData>(QUEUE_NAMES.studioGeneration);
      await queue.add("generate", {
        artifactId: artifact.id,
        roomId,
        chatId: chat.id,
        type: artifact.type,
        source: artifact.source,
        prompt: artifact.prompt,
        sourceLabel:
          artifact.source === "room_files" ? "房间文件" : "当前聊天",
      });
      await queue.close();
    } catch (err) {
      console.error(`studio-generation 重试入队失败（artifact=${artifact.id}）：`, err);
    }

    return NextResponse.json({ artifact }, { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
