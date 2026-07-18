import { NextResponse } from "next/server";
import { getBoard, getBoardAccessRole, listRoomMembers, query, resolveBoardId } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatsRow {
  type: string;
  color: string | null;
}

// p7:F06（uc-board-header-014）：组件数量按 kind 分类 + 协作者数 + 最近创建时间，服务端聚合返回。
// 分类规则与 board-canvas.tsx 的 isConnector/isText/isShape/isReloadable 优先级保持一致
// （color 哨兵：connector > text > embed；type==="rect" 判 shape；否则 note）——
// 两处各自维护是因为客户端渲染分类和这里的只读统计分类是不同关注点，硬耦合成共享模块
// 对一次性统计聚合来说不划算，保持规则文档化对齐即可。
function classify(row: StatsRow): "note" | "text" | "shape" | "connector" | "embed" {
  const base = (row.color ?? "").split("|")[0]?.split(":")[0] || "";
  if (base === "connector") return "connector";
  if (base === "text") return "text";
  if (row.type === "rect") return "shape";
  if (base === "embed") return "embed";
  return "note";
}

// GET /api/boards/:id/statistics — 组件数量分类统计 + 协作者数 + 最近创建时间（只读）。
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const boardId = await resolveBoardId(params.id);
  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });
  const role = await getBoardAccessRole(boardId, user.id);
  if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const rows = await query<StatsRow>("SELECT type, color FROM board_items WHERE board_id = $1", [boardId]);
  const byKind = { note: 0, text: 0, shape: 0, connector: 0, embed: 0 };
  for (const row of rows) byKind[classify(row)] += 1;

  const lastCreatedRows = await query<{ last_created_at: string | null }>(
    "SELECT MAX(created_at) AS last_created_at FROM board_items WHERE board_id = $1",
    [boardId],
  );
  const lastCreatedAt = lastCreatedRows[0]?.last_created_at ?? null;
  const members = await listRoomMembers(board.room_id);

  return NextResponse.json({
    total: rows.length,
    byKind,
    memberCount: members.length,
    lastCreatedAt,
  });
}
