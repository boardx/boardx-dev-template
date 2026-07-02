import { NextResponse } from "next/server";
import {
  canViewRoom,
  getRoom,
  getRoomChat,
  listRoomChatMessages,
  createPresentationArtifact,
  markPresentationArtifactError,
  type PresentationSource,
} from "@repo/data";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";
import { currentUser } from "@/lib/session";
import { listRoomFiles } from "@/lib/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 队列任务负载形状；与 apps/workflow-worker/src/presentationJob.ts 的 PresentationJobData
// 保持一致（两端各自声明，同 studio/generate 路由的既有约定，避免跨 app 深路径 import）。
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

// POST /api/presentations/generate — uc-presentations-001 主流程。
// 配置弹窗填主题/来源（聊天/文件/说明）/页数/风格 → 校验来源可用后落库（status=queued）+
// 入队异步生成（CAP-AI stub，复用 p12-F01 studio_artifacts 同款异步管线模式），202 立即
// 返回，前端轮询 GET .../presentations/artifacts 查看进度直至 ready/error。产物结果出现
// 在指定房间聊天线程中（roomId/chatId 由前端根据当前打开的聊天传入）。

const SOURCES: PresentationSource[] = ["current_chat", "room_files", "instructions"];
const STYLES = ["minimal", "vibrant", "calm"];

function isSource(v: unknown): v is PresentationSource {
  return typeof v === "string" && (SOURCES as string[]).includes(v);
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      roomId?: unknown;
      chatId?: unknown;
      topic?: unknown;
      source?: unknown;
      instructions?: unknown;
      pages?: unknown;
      style?: unknown;
    };

    const roomId = Number(body.roomId);
    const chatIdNum = Number(body.chatId);
    if (!Number.isFinite(roomId) || !Number.isFinite(chatIdNum)) {
      return NextResponse.json({ error: "缺少房间/聊天信息" }, { status: 400 });
    }
    if (!(await canViewRoom(roomId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const chat = await getRoomChat(chatIdNum);
    if (!chat || Number(chat.room_id) !== roomId) {
      return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    }
    // 与 studio/generate 一致：只读线程（非创建者）不可发起生成。
    if (chat.creator_user_id !== user.id) {
      return NextResponse.json({ error: "只读线程不可生成" }, { status: 403 });
    }

    if (!isSource(body.source)) {
      return NextResponse.json({ errors: { source: "请选择来源" } }, { status: 400 });
    }
    const topic = String(body.topic ?? "").trim();
    const instructions = String(body.instructions ?? "").trim();
    const pagesRaw = Number(body.pages);
    const pages = Number.isFinite(pagesRaw) ? Math.min(30, Math.max(1, Math.round(pagesRaw))) : 8;
    const style = STYLES.includes(String(body.style)) ? String(body.style) : "minimal";

    const room = await getRoom(roomId);
    if (!room) return NextResponse.json({ error: "房间不存在" }, { status: 404 });

    // 来源可用性校验（不可信前端：即便前端已禁用按钮，服务端仍需二次校验）。
    let sourceLabel: string;
    if (body.source === "room_files") {
      const files = await listRoomFiles(room);
      const readyFiles = files.filter((f) => f.status === "ready");
      if (readyFiles.length === 0) {
        return NextResponse.json({ errors: { source: "没有可用的房间文件" } }, { status: 400 });
      }
      sourceLabel = `房间文件 · ${readyFiles.length} 个`;
    } else if (body.source === "current_chat") {
      const messages = await listRoomChatMessages(chat.id);
      if (messages.length === 0) {
        return NextResponse.json({ errors: { source: "当前聊天暂无内容" } }, { status: 400 });
      }
      sourceLabel = `当前聊天 · ${messages.length} 条消息`;
    } else {
      // instructions：说明文本本身即来源，为空视为无来源。
      if (!instructions) {
        return NextResponse.json({ errors: { source: "请填写说明" } }, { status: 400 });
      }
      sourceLabel = "说明文本";
    }

    const artifactId = `pa_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const artifact = await createPresentationArtifact({
      id: artifactId,
      roomId,
      chatId: chat.id,
      creatorUserId: user.id,
      topic,
      source: body.source,
      instructions,
      pages,
      style,
    });

    try {
      const queue = makeQueue<PresentationJobData>(QUEUE_NAMES.presentationGeneration);
      await queue.add("generate", {
        artifactId,
        roomId,
        chatId: chat.id,
        topic,
        source: body.source,
        instructions,
        pages,
        style,
        sourceLabel,
      });
      await queue.close();
    } catch (err) {
      // 入队本身失败（如 Redis 不可用）：不能让制品永远卡在 queued——那样预览卡片会一直
      // 显示"生成中"，而重试接口只接受 error 态，用户将无路可退。立刻标记 error 并保留
      // 原因，让聊天里的失败卡片可见且可重试。
      console.error(`presentation-generation 入队失败（artifact=${artifactId}）：`, err);
      await markPresentationArtifactError(artifactId, "生成任务入队失败，请重试");
      return NextResponse.json(
        { artifact: { ...artifact, status: "error" as const, error_message: "生成任务入队失败，请重试" } },
        { status: 202 }
      );
    }

    return NextResponse.json({ artifact }, { status: 202 });
  } catch (err) {
    console.error("POST presentations/generate 失败：", err);
    return NextResponse.json({ error: "生成请求处理失败，请重试" }, { status: 500 });
  }
}
