import { NextResponse } from "next/server";
import { createFeedbackSubmission } from "@repo/data";
import { normalizeFeedbackAttachments } from "@/lib/feedback";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json()) as { message?: unknown; attachments?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "请先填写反馈内容" }, { status: 400 });
    if (message.length > 4000) return NextResponse.json({ error: "反馈内容过长" }, { status: 400 });

    const feedback = await createFeedbackSubmission({
      userId: user.id,
      message,
      attachments: normalizeFeedbackAttachments(body.attachments),
      userAgent: req.headers.get("user-agent") ?? "",
    });

    return NextResponse.json({ feedback: { id: feedback.id } }, { status: 201 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
