// apps/web/app/api/teams/[id]/memories/route.ts — 团队 Memory（04-F13，uc-team-009）
// GET  列表（owner/admin）；POST 新增 { content }，重复返回 409。
import { NextResponse } from "next/server";
import { canManageTeam } from "@repo/auth";
import { addTeamMemory, getMembership, listTeamMemories } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireManager(idParam: string) {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "未登录" }, { status: 401 }) } as const;
  const teamId = Number(idParam);
  if (!Number.isFinite(teamId)) return { error: NextResponse.json({ error: "无效 id" }, { status: 400 }) } as const;
  const role = await getMembership(teamId, user.id);
  if (!canManageTeam(role)) return { error: NextResponse.json({ error: "无权限" }, { status: 403 }) } as const;
  return { user, teamId } as const;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireManager(params.id);
  if ("error" in ctx) return ctx.error;
  return NextResponse.json({ memories: await listTeamMemories(ctx.teamId) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await requireManager(params.id);
  if ("error" in ctx) return ctx.error;
  try {
    const body = (await req.json().catch(() => ({}))) as { content?: unknown };
    const content = String(body.content ?? "").trim();
    if (!content) return NextResponse.json({ errors: { content: "内容不能为空" } }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ errors: { content: "内容不能超过 2000 字符" } }, { status: 400 });
    const memory = await addTeamMemory(ctx.teamId, content, ctx.user.id);
    if (!memory) return NextResponse.json({ error: "该 Memory 已存在" }, { status: 409 });
    return NextResponse.json({ memory }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
