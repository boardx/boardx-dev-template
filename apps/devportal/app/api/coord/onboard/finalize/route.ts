// POST /api/coord/onboard/finalize {full_name, private} — 完成接入：立刻把仓库注册
// 为目录 DO 项目（幂等；installation webhook 也会异步做同一件事——本调用保证用户
// 走完体检时马上拿到 slug 用于「进入工作区」，不必等 webhook 投递到达，p30-F05）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { postOnboardFinalize } from "@/lib/coord-gateway";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { full_name?: string; private?: boolean } | null;
  if (!body?.full_name || !body.full_name.includes("/"))
    return NextResponse.json({ error: "invalid_full_name" }, { status: 422 });

  const result = await postOnboardFinalize({ fullName: body.full_name, private: body.private === true });
  if (!result.configured) return NextResponse.json({ configured: false }, { status: 200 });
  if ("error" in result) return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  return NextResponse.json({ configured: true, slug: result.slug });
}
