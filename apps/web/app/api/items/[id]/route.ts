import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-rr-009 / p20-F10：legacy room-keyed 单条 item API 已下线（410 Gone）。
// 新模型：PATCH/DELETE 走 /api/board-items/[itemId]。
function gone() {
  return NextResponse.json(
    { error: "legacy 单画布接口已下线，请使用 /api/board-items/[itemId]" },
    { status: 410 }
  );
}

export async function GET() {
  return gone();
}
export async function PATCH() {
  return gone();
}
export async function DELETE() {
  return gone();
}
