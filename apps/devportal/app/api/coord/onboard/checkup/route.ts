// GET /api/coord/onboard/checkup?installation_id=&owner=&repo=&default_branch=
// — 四项真实自动体检（p30-F05 UC-01 步骤③）：webhook 连通 / issues·PR 镜像种子 /
// CODEOWNERS·CONTRIBUTING / 分支保护。警告不阻塞——四项都是终态，result="warn" 不是失败。
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

  const result = await fetchOnboardCheckup({ installationId, owner, repo, defaultBranch });
  if (!result.configured) return NextResponse.json({ configured: false }, { status: 200 });
  if ("error" in result) return NextResponse.json({ configured: true, error: result.error }, { status: 502 });
  return NextResponse.json({ configured: true, items: result.items });
}
