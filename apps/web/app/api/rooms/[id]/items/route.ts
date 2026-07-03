import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-rr-009 / p20-F10：legacy 单画布 items API 已下线（410 Gone）。
// 新模型：先 POST /api/rooms/[id]/boards 建板，再走 /api/boards/[id]/items。
function gone() {
  return NextResponse.json(
    { error: "legacy 单画布接口已下线，请使用 /api/boards/[id]/items" },
    { status: 410 }
  );
}

export async function GET() {
  return gone();
}
export async function POST() {
  return gone();
}
export async function PATCH() {
  return gone();
}
export async function DELETE() {
  return gone();
}
