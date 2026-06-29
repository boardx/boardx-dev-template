import { NextResponse } from "next/server";
import { getMembership, listMembers } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const teamId = Number(params.id);
  // 团队成员才能查看成员列表
  if (!(await getMembership(teamId, user.id))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return NextResponse.json({ members: await listMembers(teamId) });
}
