import { NextResponse } from "next/server";
import { getBoardAccessRole } from "@repo/data";
import { currentUser } from "@/lib/session";
import { heartbeat, listOnline, type PresenceCursor, type PresenceViewport } from "@/lib/presence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-collab-001 协作感知：从心跳 body 解析可选的 operating + viewport（容错，字段缺失/畸形时退化为空）。
function parseAwareness(body: unknown): {
  operating?: boolean;
  viewport?: PresenceViewport;
  cursor?: PresenceCursor;
  followingId?: number | null;
  followPaused?: boolean;
} {
  if (!body || typeof body !== "object") return {};
  const b = body as Record<string, unknown>;
  const out: {
    operating?: boolean;
    viewport?: PresenceViewport;
    cursor?: PresenceCursor;
    followingId?: number | null;
    followPaused?: boolean;
  } = {};
  if (typeof b.operating === "boolean") out.operating = b.operating;
  const v = b.viewport;
  if (v && typeof v === "object") {
    const vp = v as Record<string, unknown>;
    if (typeof vp.x === "number" && typeof vp.y === "number" && typeof vp.scale === "number") {
      out.viewport = { x: vp.x, y: vp.y, scale: vp.scale };
    }
  }
  const c = b.cursor;
  if (c && typeof c === "object") {
    const cursor = c as Record<string, unknown>;
    if (typeof cursor.x === "number" && typeof cursor.y === "number" && typeof cursor.visible === "boolean") {
      out.cursor = { x: cursor.x, y: cursor.y, visible: cursor.visible };
    }
  }
  if (typeof b.followingId === "number") out.followingId = b.followingId;
  else if (typeof b.followingId === "string" && b.followingId.trim() !== "" && Number.isFinite(Number(b.followingId))) {
    out.followingId = Number(b.followingId);
  }
  else if (b.followingId === null) out.followingId = null;
  if (typeof b.followPaused === "boolean") out.followPaused = b.followPaused;
  return out;
}

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
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = Number(params.id);
  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });
  const name =
    user.display_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
    user.email;
  // uc-collab-001：心跳可携带协作感知（operating + viewport）。body 可选，缺失时按普通心跳处理。
  const body = await req.json().catch(() => null);
  const { operating, viewport, cursor, followingId, followPaused } = parseAwareness(body);
  heartbeat(boardId, { id: user.id, name, role, operating, viewport, cursor, followingId, followPaused });
  const members = listOnline(boardId);
  return NextResponse.json({ members, count: members.length, self: { id: user.id, role } });
}
