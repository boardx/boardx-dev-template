// apps/web/app/api/ava/threads/[id]/share/email/route.ts — p18 F08 分享聊天「发送到我的邮箱」
// 鉴权口径与 ../route.ts 一致（#153：user_id + team_id 同时校验）；
// 邮件走既有 dev transport（apps/web/lib/mailer.ts），不新建邮件基础设施。
import { NextResponse } from "next/server";
import { enableAvaThreadShare, getAvaThread, getAvaThreadShare } from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";
import { isThreadInCurrentContext } from "@/lib/ava-thread-auth";
import { sendShareLinkEmail, RateLimitedError } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const threadId = Number(params.id);
    if (!Number.isFinite(threadId)) {
      return NextResponse.json({ error: "无效的线程 id" }, { status: 400 });
    }

    const thread = await getAvaThread(threadId);
    // #153 口径：user_id 与 team_id 同时校验，统一走 isThreadInCurrentContext。
    if (!thread || !isThreadInCurrentContext(thread, user.id, currentTeamId())) {
      return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    }

    // 未开启分享时先自动生成链接再发送（复用既有 enable 能力，幂等）。
    let share = await getAvaThreadShare(threadId);
    if (!share || !share.share_enabled) {
      share = await enableAvaThreadShare(threadId);
    }

    const origin = new URL(req.url).origin;
    const shareUrl = `${origin}/chatShare/${threadId}?shareToken=${encodeURIComponent(share.share_token)}`;
    try {
      await sendShareLinkEmail({ to: user.email, shareUrl, threadTitle: thread.title ?? "" });
    } catch (err) {
      if (err instanceof RateLimitedError) {
        return NextResponse.json({ error: "发送太频繁，请稍后再试" }, { status: 429 });
      }
      throw err;
    }

    return NextResponse.json({ ok: true, to: user.email, share });
  } catch (err) {
    // 原始错误只记服务端日志；客户端只收到通用文案（同 F02/F07/F11 review 指出的同类问题）。
    console.error("[ava/share/email] 发送失败", err);
    return NextResponse.json({ error: "发送失败，请重试" }, { status: 500 });
  }
}
