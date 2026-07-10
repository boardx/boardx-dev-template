import { NextResponse } from "next/server";
import {
  AI_INSTRUCTION_MAX_LEN,
  canManageRoom,
  canViewRoom,
  deleteRoom,
  getRoom,
  isRoomOwner,
  listFavoriteRoomIds,
  resolveRoomId,
  type RoomVisibility,
  updateRoom,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const roomId = await resolveRoomId(params.id);
  const room = await getRoom(roomId);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canViewRoom(roomId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  const favoriteIds = await listFavoriteRoomIds(user.id);
  // bigint 列经 pg 驱动可能回传为字符串，统一转 String 再比较，避免类型不一致误判
  const isFavorite = favoriteIds.some((id) => String(id) === String(roomId));
  return NextResponse.json({ room, isFavorite });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    // uc-rr-006 权限矩阵：房间名/可见性等字段 owner/admin 均可修改
    if (!(await canManageRoom(roomId, user.id))) {
      return NextResponse.json({ error: "仅 owner/admin 可修改" }, { status: 403 });
    }
    const body = (await req.json()) as {
      name?: unknown;
      visibility?: unknown;
      description?: unknown;
      ai_instruction?: unknown;
    };
    const fields: {
      name?: string;
      visibility?: RoomVisibility;
      description?: string | null;
      ai_instruction?: string | null;
    } = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ errors: { name: "房间名不能为空" } }, { status: 400 });
      fields.name = name;
    }
    if (body.visibility !== undefined) fields.visibility = body.visibility === "team" ? "team" : "private";
    // uc-rr-010（p20/F11）：About & AI 区块新增字段，走同一 PATCH 路径、同一 canManageRoom 判定。
    if (body.description !== undefined) {
      const description = body.description === null ? null : String(body.description);
      fields.description = description === "" ? null : description;
    }
    if (body.ai_instruction !== undefined) {
      const aiInstruction = body.ai_instruction === null ? null : String(body.ai_instruction);
      if (aiInstruction && aiInstruction.length > AI_INSTRUCTION_MAX_LEN) {
        return NextResponse.json(
          { errors: { ai_instruction: `AI instruction 不能超过 ${AI_INSTRUCTION_MAX_LEN} 字符` } },
          { status: 400 }
        );
      }
      fields.ai_instruction = aiInstruction === "" ? null : aiInstruction;
    }
    await updateRoom(roomId, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const roomId = await resolveRoomId(params.id);
    // uc-rr-006 权限矩阵：删除房间仅 owner
    if (!(await isRoomOwner(roomId, user.id))) {
      return NextResponse.json({ error: "仅 owner 可删除" }, { status: 403 });
    }
    await deleteRoom(roomId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
