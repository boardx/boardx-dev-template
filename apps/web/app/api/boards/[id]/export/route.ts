import { NextResponse } from "next/server";
import { getBoard, getBoardAccessRole, listBoardItems } from "@repo/data";
import { renderBoard, type ExportFormat, type ExportItem } from "@repo/export";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/boards/:id/export?format=pdf|svg[&ids=a,b,c]
// headless 导出能力（#638）：把白板渲染成 PDF/SVG。解锁 p7-F09（幻灯片导出）、
// p7-F15（导出选中内容 = 传 ids 过滤子集）。鉴权同白板读取：owner/editor/viewer
// 或 public 只读；无权 403、不存在 404。渲染走 @repo/export（纯 JS，零原生依赖，
// 不需要 headless chrome——见该包头注的架构选择）。
const FORMATS = new Set<ExportFormat>(["pdf", "svg"]);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const boardId = Number(params.id);
  if (!Number.isInteger(boardId)) return NextResponse.json({ error: "invalid board id" }, { status: 400 });

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "pdf") as ExportFormat;
  if (!FORMATS.has(format)) return NextResponse.json({ error: "unsupported_format" }, { status: 400 });

  const board = await getBoard(boardId);
  if (!board) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 鉴权：与白板读取一致——登录用户按角色，匿名仅 public 只读
  const user = await currentUser();
  if (!user) {
    if (board.visibility !== "public") return NextResponse.json({ error: "未登录" }, { status: 401 });
  } else {
    const role = await getBoardAccessRole(boardId, user.id);
    if (!role) return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const rows = await listBoardItems(boardId);
  // p7-F15 选中导出：?ids=a,b,c 过滤子集；缺省导出全部
  const idsParam = url.searchParams.get("ids");
  const idSet = idsParam ? new Set(idsParam.split(",").map((s) => s.trim()).filter(Boolean)) : null;
  const items: ExportItem[] = rows
    .filter((r) => !idSet || idSet.has(r.id))
    .map((r) => ({ type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, text: r.text, color: r.color ?? null }));

  const rendered = await renderBoard(items, format, { title: board.name ?? `board-${boardId}` });
  const filename = `${(board.name ?? "board").replace(/[^\w.-]+/g, "_")}-${boardId}.${rendered.extension}`;
  return new NextResponse(Buffer.from(rendered.body), {
    status: 200,
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
