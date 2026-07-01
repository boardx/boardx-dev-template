import { NextResponse } from "next/server";
import {
  canViewRoom,
  getRoom,
  getRoomChat,
  listRoomChatMessages,
  listKbFiles,
  createStudioArtifact,
  type StudioArtifactType,
  type StudioArtifactSource,
} from "@repo/data";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 队列任务负载形状；与 apps/workflow-worker/src/studioJob.ts 的 StudioJobData 保持一致
// （两端各自声明，同 apps/web/app/api/jobs/route.ts 对 JobData 的既有约定，避免跨 app 深路径 import）。
interface StudioJobData {
  artifactId: string;
  roomId: number;
  chatId: number;
  type: StudioArtifactType;
  source: StudioArtifactSource;
  prompt: string;
  sourceLabel: string;
}

// POST /api/rooms/:id/chats/:chatId/studio/generate — uc-studio-001 主流程 7-9。
// 校验来源可用后落库（status=queued）+ 入队异步生成（CAP-AI stub），202 立即返回，
// 前端轮询 GET .../studio/artifacts 查看进度直至 ready/error。

const TYPES: StudioArtifactType[] = ["audio", "infographic", "presentation"];
const SOURCES: StudioArtifactSource[] = ["room_files", "current_chat"];

function isType(v: unknown): v is StudioArtifactType {
  return typeof v === "string" && (TYPES as string[]).includes(v);
}
function isSource(v: unknown): v is StudioArtifactSource {
  return typeof v === "string" && (SOURCES as string[]).includes(v);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string; chatId: string } }
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
    // 与发消息一致：只读线程（非创建者）不可发起生成。
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "只读线程不可生成" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      type?: unknown;
      source?: unknown;
      prompt?: unknown;
    };
    if (!isType(body.type)) {
      return NextResponse.json({ errors: { type: "请选择生成类型" } }, { status: 400 });
    }
    if (!isSource(body.source)) {
      return NextResponse.json({ errors: { source: "请选择来源" } }, { status: 400 });
    }
    const prompt = String(body.prompt ?? "").trim();

    const room = await getRoom(roomId);

    // 来源可用性校验（不可信前端：即便前端已禁用按钮，服务端仍需二次校验）。
    let sourceLabel: string;
    if (body.source === "room_files") {
      const files =
        room?.team_id != null
          ? await listKbFiles({ ownerUserId: user.id, scope: "team", teamId: room.team_id })
          : await listKbFiles({ ownerUserId: user.id, scope: "personal" });
      const readyFiles = files.filter((f) => f.status === "ready");
      if (readyFiles.length === 0) {
        return NextResponse.json({ errors: { source: "没有可用的房间文件" } }, { status: 400 });
      }
      sourceLabel = `房间文件 · ${readyFiles.length} 个`;
    } else {
      const messages = await listRoomChatMessages(chat.id);
      if (messages.length === 0) {
        return NextResponse.json({ errors: { source: "当前聊天暂无内容" } }, { status: 400 });
      }
      sourceLabel = `当前聊天 · ${messages.length} 条消息`;
    }

    const artifactId = `sa_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const artifact = await createStudioArtifact({
      id: artifactId,
      roomId,
      chatId: chat.id,
      creatorUserId: user.id,
      type: body.type,
      source: body.source,
      prompt,
    });

    try {
      const queue = makeQueue<StudioJobData>(QUEUE_NAMES.studioGeneration);
      await queue.add("generate", {
        artifactId,
        roomId,
        chatId: chat.id,
        type: body.type,
        source: body.source,
        prompt,
        sourceLabel,
      });
      await queue.close();
    } catch (err) {
      console.error(`studio-generation 入队失败（artifact=${artifactId}）：`, err);
    }

    return NextResponse.json({ artifact }, { status: 202 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
