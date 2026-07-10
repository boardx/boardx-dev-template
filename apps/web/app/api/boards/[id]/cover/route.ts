import { NextResponse } from "next/server";
import { getBoard, canManageBoard, canViewBoard, updateBoard } from "@repo/data";
import {
  BOARD_COVER_ALLOWED_EXT,
  BOARD_COVER_MAX_BYTES,
  buildBoardCoverObjectKey,
  ensureBucket,
  extOf,
  presignGetUrl,
  putObject,
} from "@repo/storage";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/boards/:id/cover — 上传封面（管理者）。把 objectKey 存进 boards.cover。
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ errors: { file: "请选择图片" } }, { status: 400 });
    }
    const ext = extOf(file.name);
    if (!BOARD_COVER_ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { errors: { file: `不支持的图片类型 .${ext || "?"}（仅 ${BOARD_COVER_ALLOWED_EXT.join("/")}）` } },
        { status: 400 }
      );
    }
    if (file.size > BOARD_COVER_MAX_BYTES) {
      return NextResponse.json({ errors: { file: "图片过大（上限 5MB）" } }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    await ensureBucket();
    const key = buildBoardCoverObjectKey({ boardId, fileName: file.name });
    await putObject(key, buf, file.type || "image/png");

    const updated = await updateBoard(boardId, { cover: key });
    return NextResponse.json({ board: updated });
  } catch (err) {
    console.error("[boards/:id/cover POST] 操作失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET /api/boards/:id/cover — 签发展示用临时 GET URL（可看者），302 重定向到签名 URL。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canViewBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    if (!board.cover) return NextResponse.json({ error: "无封面" }, { status: 404 });

    const url = await presignGetUrl(board.cover, 300);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    console.error("[boards/:id/cover GET] 操作失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
