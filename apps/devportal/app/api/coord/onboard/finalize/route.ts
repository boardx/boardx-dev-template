// POST /api/coord/onboard/finalize {full_name, private, installation_id} — 完成接入：
// 立刻把仓库注册为目录 DO 项目（幂等；installation webhook 也会异步做同一件事——
// 本调用保证用户走完体检时马上拿到 slug 用于「进入工作区」，不必等 webhook 投递到达，
// p30-F05）。
//
// 授权：login 恒取自服务端 session（user.login），绝不接受客户端传入。此前 admin
// 校验只在前端做（UI 用 is_admin 禁用非 admin 仓选项），服务端完全没强制——任意
// 登录用户可直接 POST 任意 full_name 把任意仓注册成租户项目，造成 slug 抢注/目录
// 污染（IDOR 修复，#776 review）。gateway 侧会核实该 login 对 full_name 是否有
// admin 权限，非 admin 一律 403，这里原样透传给前端。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { postOnboardFinalize } from "@/lib/coord-gateway";

export const runtime = "edge";

export async function POST(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { full_name?: string; private?: boolean; installation_id?: number }
    | null;
  if (!body?.full_name || !body.full_name.includes("/"))
    return NextResponse.json({ error: "invalid_full_name" }, { status: 422 });
  if (!body.installation_id) return NextResponse.json({ error: "missing_installation_id" }, { status: 422 });

  const result = await postOnboardFinalize({
    fullName: body.full_name,
    private: body.private === true,
    installationId: body.installation_id,
    login: user.login,
  });
  if (!result.configured) return NextResponse.json({ configured: false }, { status: 200 });
  if ("error" in result) {
    const status = result.error === "not_admin" ? 403 : 502;
    return NextResponse.json({ configured: true, error: result.error }, { status });
  }
  return NextResponse.json({ configured: true, slug: result.slug });
}
