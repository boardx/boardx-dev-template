import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { createTeam, listUserTeams } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ teams: await listUserTeams(user.id) });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as { name?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ errors: { name: "团队名不能为空" } }, { status: 400 });
    const team = await createTeam(name, user.id);
    cookies().set(CURRENT_TEAM_COOKIE, String(team.id), { httpOnly: true, sameSite: "lax", path: "/" });
    return NextResponse.json({ team }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
