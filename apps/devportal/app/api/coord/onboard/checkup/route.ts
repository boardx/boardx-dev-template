// GET /api/coord/onboard/checkup?installation_id=&owner=&repo=&default_branch=
// — 四项真实自动体检（p30-F05 UC-01 步骤③）：webhook 连通 / issues·PR 镜像种子 /
// CODEOWNERS·CONTRIBUTING / 分支保护。警告不阻塞——四项都是终态，result="warn" 不是失败。
//
// 授权：login 恒取自服务端 session（user.login），绝不接受客户端传入——否则任意
// 登录用户可对任意 owner/repo 触发体检，借平台 App token 侦察目标仓配置（IDOR
// 修复，#776 review）。gateway 侧会核实该 login 对 owner/repo 是否有 admin 权限，
// 非 admin 一律 403，这里原样透传给前端。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { fetchOnboardCheckup } from "@/lib/coord-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id") ?? "");
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  const defaultBranch = url.searchParams.get("default_branch") ?? "main";
  if (!installationId || !owner || !repo)
    return NextResponse.json({ error: "missing_params" }, { status: 422 });

  const result = await fetchOnboardCheckup({ installationId, owner, repo, defaultBranch, login: user.login });
  if (!result.configured) return NextResponse.json({ configured: false }, { status: 200 });
  if ("error" in result) {
    const status = result.error === "not_admin" ? 403 : 502;
    return NextResponse.json({ configured: true, error: result.error }, { status });
  }
  return NextResponse.json({ configured: true, items: result.items });
}
