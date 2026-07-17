import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import { getMembership, renameTeam, updateTeam, deleteTeam } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = Number(params.id);
    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }
    const body = (await req.json()) as { name?: unknown; description?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ errors: { name: "团队名不能为空" } }, { status: 400 });
    if ("description" in body) {
      await updateTeam(teamId, { name, description: String(body.description ?? "").trim() });
    } else {
      await renameTeam(teamId, name);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const teamId = Number(params.id);
    // 仅 owner 可删除团队
    if ((await getMembership(teamId, user.id)) !== "owner") {
      return NextResponse.json({ error: "仅 owner 可删除团队" }, { status: 403 });
    }
    await deleteTeam(teamId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
