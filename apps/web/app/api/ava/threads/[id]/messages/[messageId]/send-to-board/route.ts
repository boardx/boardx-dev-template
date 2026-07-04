// apps/web/app/api/ava/threads/[id]/messages/[messageId]/send-to-board/route.ts
// — p18 F11 消息「发送到 Board」
//
// POST /api/ava/threads/:id/messages/:messageId/send-to-board  { boardId: number }
// 校验登录 + 线程属主（user_id/team_id 同时校验，isThreadInCurrentContext）+ 目标消息属于
// 该线程 + 目标 board 用户拥有编辑权限（owner/editor，否则 403「无编辑权限」）。
// 写入方式与 apps/web/app/api/boards/[id]/items/route.ts 的 POST 一致：插入一个
// board-keyed "note"（便利贴）item，text = 该条消息内容。放置坐标固定在原点附近，
// 因为触发来源是 AVA 侧栏而非打开的画布，没有可参考的鼠标/视口位置。
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getAvaThread,
  listAvaMessages,
  getBoard,
  getBoardAccessRole,
  insertItem,
  type BoardItemRow,
} from "@repo/data";
import { DEFAULT_SIZE } from "@repo/canvas";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const threadId = Number(params.id);
    const messageId = Number(params.messageId);
    if (!Number.isFinite(threadId) || !Number.isFinite(messageId)) {
      return NextResponse.json({ error: "无效的消息 id" }, { status: 400 });
    }

    const thread = await getAvaThread(threadId);
    if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
      return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    }

    const messages = await listAvaMessages(threadId);
    const target = messages.find((m) => String(m.id) === String(messageId));
    if (!target || target.role !== "assistant") {
      return NextResponse.json({ error: "只能发送 AI 回复" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { boardId?: unknown };
    const boardId = Number(body.boardId);
    if (!Number.isFinite(boardId)) {
      return NextResponse.json({ error: "无效的 board id" }, { status: 400 });
    }

    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "白板不存在" }, { status: 404 });

    const role = await getBoardAccessRole(boardId, user.id);
    if (role !== "owner" && role !== "editor") {
      return NextResponse.json({ error: "无编辑权限" }, { status: 403 });
    }

    const size = DEFAULT_SIZE.note;
    const item: BoardItemRow = {
      id: randomUUID(),
      room_id: board.room_id,
      board_id: boardId,
      type: "note",
      x: 40,
      y: 40,
      w: size.w,
      h: size.h,
      text: target.content,
    };
    const inserted = await insertItem(item);
    return NextResponse.json({ ok: true, item: inserted, board });
  } catch (err) {
    // 原始错误只记服务端日志；客户端只收到通用文案（同 F02/F07 review 指出的同类问题）。
    console.error("[ava/send-to-board] 发送失败", err);
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 500 });
  }
}
