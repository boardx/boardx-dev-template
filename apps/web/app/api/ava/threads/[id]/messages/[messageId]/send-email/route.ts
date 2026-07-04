// apps/web/app/api/ava/threads/[id]/messages/[messageId]/send-email/route.ts
// — p18 F11 消息「发送邮件」
//
// POST /api/ava/threads/:id/messages/:messageId/send-email
// 鉴权口径与 send-to-board/share/email 一致（isThreadInCurrentContext）。
// 邮件走既有 dev transport（apps/web/lib/mailer.ts 的 sendAvaMessageEmail），与 F08
// 分享聊天邮件同一底层（recordOutboundEmail 落库 + 打日志）。
// 频控（PR #321 review 登记的硬前置）：同一用户 1 分钟内最多发 1 封，命中时返回 429，
// 前端展示独立提示（不与「发送到 Board」共用状态）。
import { NextResponse } from "next/server";
import { getAvaThread, listAvaMessages } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";
import { sendAvaMessageEmail, RateLimitedError } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
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

    try {
      await sendAvaMessageEmail({
        to: user.email,
        messageContent: target.content,
        threadTitle: thread.title ?? "",
      });
    } catch (err) {
      if (err instanceof RateLimitedError) {
        return NextResponse.json({ error: "发送太频繁，请稍后再试" }, { status: 429 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true, to: user.email });
  } catch (err) {
    // 原始错误只记服务端日志；客户端只收到通用文案（同 F02/F07 review 指出的同类问题）。
    console.error("[ava/send-email] 发送失败", err);
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 500 });
  }
}
