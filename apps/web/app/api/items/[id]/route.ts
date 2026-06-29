import { NextResponse } from "next/server";
import { getItem, updateItem, deleteItem, canViewRoom } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 取 item 并校验当前用户对其所属 room 有权限。 */
async function loadAuthorized(itemId: string, userId: number) {
  const item = await getItem(itemId);
  if (!item) return { error: "not found", status: 404 as const };
  if (!(await canViewRoom(item.room_id, userId))) return { error: "无权限", status: 403 as const };
  return { item };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const auth = await loadAuthorized(params.id, user.id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = (await req.json()) as { x?: unknown; y?: unknown; text?: unknown };
    const fields: { x?: number; y?: number; text?: string } = {};
    if (body.x !== undefined && body.y !== undefined) {
      fields.x = Math.trunc(Number(body.x));
      fields.y = Math.trunc(Number(body.y));
    }
    if (body.text !== undefined) fields.text = String(body.text);
    await updateItem(params.id, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const auth = await loadAuthorized(params.id, user.id);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    await deleteItem(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
