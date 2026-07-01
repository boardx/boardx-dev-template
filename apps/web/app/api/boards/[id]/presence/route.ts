import { NextResponse } from "next/server";
import { getBoardAccessRole } from "@repo/data";
import { currentUser } from "@/lib/session";
import { heartbeat, listOnline } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-canvas-005 实时协作：在线成员 presence 通道。
// presence 是短暂状态，用进程内内存表（无需 migration）；单 dev/prod server 场景足够，
// 也天然满足「无权限用户不能通过协作通道写入」——写入前先门控 board 访问角色。

// GET /api/boards/:id/presence — 返回当前在线成员（可见者，否则 403）。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = Number(params.id);
  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const members = listOnline(boardId);
  return NextResponse.json({ members, count: members.length });
}

// POST /api/boards/:id/presence — 心跳，把自己登记进在线成员表（可见者，否则 403）。
// 只读者也算「在线」（UC 备选流程 1：只读同步展示），但 items 写通道仍会 403。
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = Number(params.id);
  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const name =
    user.display_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email;
  heartbeat(boardId, { id: user.id, name, role });
  const members = listOnline(boardId);
  return NextResponse.json({ members, count: members.length, self: { id: user.id, role } });
}
