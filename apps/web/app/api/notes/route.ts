import { NextResponse } from "next/server";
import { createNote, listNotes } from "@repo/data";

// 走 pg，需 Node runtime；动态以免被静态化
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const notes = await listNotes();
    return NextResponse.json({ notes });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: unknown };
    if (typeof body.text !== "string" || body.text.trim() === "") {
      return NextResponse.json({ error: "text 必填且非空" }, { status: 400 });
    }
    const note = await createNote(body.text);
    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
