import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE: stub only — 不含真实 AI 生成 / PPTX 渲染（见 UC「不包含」）。
// 演示文稿任务保存在进程内存中，按 owner 关联（UC 业务规则 2）。重启即清空。
export interface Slide {
  n: number;
  title: string;
}
export interface Deck {
  id: string;
  ownerId: number;
  title: string;
  pages: number;
  style: string;
  prompt: string;
  status: "ready";
  createdAt: number;
  slides: Slide[];
}

const decks: Deck[] = [];

const STYLES = new Set(["minimal", "vibrant", "calm"]);
const DEFAULT_PROMPT = "根据当前对话和文件内容生成一套演示文稿"; // UC 主流程 4

function buildSlides(title: string, pages: number): Slide[] {
  // stub 大纲：首页用标题，其余按页码占位（无真实 AI）。
  return Array.from({ length: pages }, (_, i) => ({
    n: i + 1,
    title: i === 0 ? title : `${title} — 第 ${i + 1} 页`,
  }));
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const mine = decks.filter((d) => d.ownerId === user.id);
  return NextResponse.json({ decks: mine });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as {
      title?: unknown;
      pages?: unknown;
      style?: unknown;
      prompt?: unknown;
    };
    const title = String(body.title ?? "").trim();
    if (!title) {
      return NextResponse.json({ errors: { title: "标题不能为空" } }, { status: 400 });
    }
    const pagesRaw = Number(body.pages);
    const pages = Number.isFinite(pagesRaw) ? Math.min(20, Math.max(1, Math.round(pagesRaw))) : 10;
    const style = STYLES.has(String(body.style)) ? String(body.style) : "minimal";
    const prompt = String(body.prompt ?? "").trim() || DEFAULT_PROMPT;

    const deck: Deck = {
      id: `deck_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      ownerId: user.id,
      title,
      pages,
      style,
      prompt,
      status: "ready",
      createdAt: Date.now(),
      slides: buildSlides(title, pages),
    };
    decks.push(deck);
    // note: 真实实现会提交 AI 任务并返回 PPTX 附件；此处直接返回 stub deck。
    return NextResponse.json({ deck, note: "stub" }, { status: 201 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
