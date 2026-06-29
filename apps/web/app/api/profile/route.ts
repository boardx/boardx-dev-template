import { NextResponse } from "next/server";
import { resolveDisplayName } from "@repo/auth";
import { getProfile, updateProfile } from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const p = await getProfile(user.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    profile: {
      email: p.email,
      displayName: resolveDisplayName({
        displayName: p.display_name,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
      }),
      avatar: p.avatar,
    },
  });
}

export async function PATCH(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    const body = (await req.json()) as { displayName?: unknown; avatar?: unknown };
    const fields: { displayName?: string; avatar?: string } = {};
    if (body.displayName !== undefined) {
      const name = String(body.displayName).trim();
      if (!name) return NextResponse.json({ errors: { displayName: "显示名不能为空" } }, { status: 400 });
      fields.displayName = name;
    }
    if (body.avatar !== undefined) fields.avatar = String(body.avatar);
    await updateProfile(user.id, fields);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
