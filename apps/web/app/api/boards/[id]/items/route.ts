import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getBoard, getBoardAccessRole, listBoardItems, insertItem, type BoardItemRow } from "@repo/data";
import { DEFAULT_SIZE, validateNewItem, isItemType } from "@repo/canvas";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/boards/:id/items — board-keyed item 列表（可见者，否则 403）。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = Number(params.id);
  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });
  return NextResponse.json({ items: await listBoardItems(boardId) });
}

// POST /api/boards/:id/items — 新增 board-keyed item（owner/editor，viewer 403）。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    const role = await getBoardAccessRole(boardId, user.id);
    if (role !== "owner" && role !== "editor") {
      return NextResponse.json({ error: "无编辑权限" }, { status: 403 });
    }
    const body = (await req.json()) as {
      id?: unknown;
      type?: unknown;
      x?: unknown;
      y?: unknown;
      w?: unknown;
      h?: unknown;
      text?: unknown;
    };

    // restore 模式（撤销删除）：带原 id + 完整几何，原样还原，保持 id 稳定（F09）。
    if (typeof body.id === "string" && body.id.length > 0) {
      const restored: BoardItemRow = {
        id: body.id,
        room_id: board.room_id,
        board_id: boardId,
        type: isItemType(String(body.type)) ? (body.type as "note" | "rect") : "note",
        x: Math.trunc(Number(body.x) || 0),
        y: Math.trunc(Number(body.y) || 0),
        w: Math.trunc(Number(body.w)) || DEFAULT_SIZE.note.w,
        h: Math.trunc(Number(body.h)) || DEFAULT_SIZE.note.h,
        text: typeof body.text === "string" ? body.text : "",
      };
      return NextResponse.json({ item: await insertItem(restored) }, { status: 201 });
    }

    const v = validateNewItem(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    const type = isItemType(String(body.type)) ? (body.type as "note" | "rect") : "note";
    const size = DEFAULT_SIZE[type];
    const item: BoardItemRow = {
      id: randomUUID(),
      room_id: board.room_id,
      board_id: boardId,
      type,
      x: Math.trunc(Number(body.x)),
      y: Math.trunc(Number(body.y)),
      w: size.w,
      h: size.h,
      text: typeof body.text === "string" ? body.text : "",
    };
    return NextResponse.json({ item: await insertItem(item) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
