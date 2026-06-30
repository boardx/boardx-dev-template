import { NextResponse } from "next/server";
import {
  getBoard,
  getBoardAccessRole,
  recordBoardVisit,
  canManageBoard,
  canSetBoardVisibility,
  updateBoard,
  deleteBoard,
  type BoardMetaFields,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/boards/:id — 返回白板元数据 + 当前用户角色（owner/editor/viewer）。
// 无权访问 403；不存在 404；public 白板对任意登录用户以 viewer 只读放行。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const boardId = Number(params.id);
  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });

  const user = await currentUser();

  // 匿名：仅 public 白板可只读访问；否则 401（提示登录）。
  if (!user) {
    if (board.visibility === "public") {
      return NextResponse.json({
        board,
        role: "viewer",
        canManage: false,
        canSetVisibility: false,
        anonymous: true,
      });
    }
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });

  // 记录最近访问（供 F03 最近列表排序）
  await recordBoardVisit(boardId, user.id);

  const canManage = role === "owner" || (await canManageBoard(boardId, user.id));
  const canSetVisibility = await canSetBoardVisibility(boardId, user.id);
  return NextResponse.json({ board, role, canManage, canSetVisibility, anonymous: false });
}

// PATCH /api/boards/:id — 更新元信息（name/category/description/cover）。仅管理者，否则 403。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fields: BoardMetaFields = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ errors: { name: "白板名不能为空" } }, { status: 400 });
      fields.name = name;
    }
    if (body.category !== undefined) fields.category = body.category === null ? null : String(body.category);
    if (body.description !== undefined)
      fields.description = body.description === null ? null : String(body.description);
    if (body.cover !== undefined) fields.cover = body.cover === null ? null : String(body.cover);

    const updated = await updateBoard(boardId, fields);
    return NextResponse.json({ board: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE /api/boards/:id — 删除白板。仅管理者，否则 403。
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const boardId = Number(params.id);
    const board = await getBoard(boardId);
    if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageBoard(boardId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }
    await deleteBoard(boardId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
