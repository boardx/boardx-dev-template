// apps/web/app/api/ava/route.ts — AVA 聊天主流程 API（uc-ava-001-start-chat）
//
// 范围：主流程 only — 列出线程 + 该线程消息（GET），发送一条用户消息并返回
// 一条 stub 助手回复（POST）。按用户隔离的内存存储，无真实 LLM、无 DB。
//
// 超出主流程、本 feature 未实现（OUT OF SCOPE，见 UC 第 7/10 步与备选/异常分支）：
//   Deep Research、附件/图片、语音/实时转录、模型/Agent 切换、工具上下文、
//   团队切换清理、分享只读访问、消息编辑/重生成/反馈、跨进程持久化。
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface AvaMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

export interface AvaThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AvaMessage[];
}

// 按用户隔离的内存存储：userId -> threads。进程级，重启即清空（无 DB，符合本 feature 范围）。
type UserStore = Map<string, AvaThread>;
const store = new Map<number, UserStore>();

function userThreads(userId: number): UserStore {
  let t = store.get(userId);
  if (!t) {
    t = new Map();
    store.set(userId, t);
  }
  return t;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromText(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || "New chat";
}

// stub 助手回复 —— 没有真实 LLM，仅回显并标注这是占位回复。
function stubReply(userText: string): string {
  return `这是 AVA 的占位回复（stub，未接入真实模型）。你说：「${userText.trim()}」。`;
}

function publicThread(t: AvaThread) {
  return {
    id: t.id,
    title: t.title,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    preview: t.messages.length ? t.messages[t.messages.length - 1]!.text : "",
  };
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const threads = userThreads(user.id);
  const chatId = new URL(req.url).searchParams.get("chatId");

  if (chatId) {
    const t = threads.get(chatId);
    if (!t) return NextResponse.json({ error: "线程不存在" }, { status: 404 });
    return NextResponse.json({ thread: publicThread(t), messages: t.messages });
  }

  const list = [...threads.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(publicThread);
  return NextResponse.json({ threads: list });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json()) as { chatId?: unknown; text?: unknown };
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ errors: { text: "消息不能为空" } }, { status: 400 });

    const threads = userThreads(user.id);
    const now = Date.now();

    // 进入已有线程或新建线程（在当前线程发送第一条消息即创建）。
    let thread: AvaThread;
    if (body.chatId != null && body.chatId !== "") {
      const existing = threads.get(String(body.chatId));
      if (!existing) return NextResponse.json({ error: "线程不存在" }, { status: 404 });
      thread = existing;
    } else {
      thread = { id: uid("th"), title: titleFromText(text), createdAt: now, updatedAt: now, messages: [] };
      threads.set(thread.id, thread);
    }

    const userMsg: AvaMessage = { id: uid("m"), role: "user", text, createdAt: now };
    const assistantMsg: AvaMessage = { id: uid("m"), role: "assistant", text: stubReply(text), createdAt: now + 1 };
    thread.messages.push(userMsg, assistantMsg);
    thread.updatedAt = now + 1;
    if (thread.messages.length === 2) thread.title = titleFromText(text);

    return NextResponse.json(
      { thread: publicThread(thread), userMessage: userMsg, assistantMessage: assistantMsg },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
