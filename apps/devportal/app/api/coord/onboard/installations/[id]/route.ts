// GET /api/coord/onboard/installations/:id — installation 回执 + 真实仓库列表
// （is_admin 已按登录者 GitHub login 判定，p30-F05 UC-01 步骤①②）。
// 服务端代读 coord-gateway（COORD_API_TOKEN 永不下发浏览器，同 lib/coord-gateway.ts 纪律）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { fetchOnboardInstallation } from "@/lib/coord-gateway";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const installationId = Number(id);
  if (!Number.isFinite(installationId) || installationId <= 0)
    return NextResponse.json({ error: "invalid_installation_id" }, { status: 422 });

  const result = await fetchOnboardInstallation(installationId, user.login);
  if (!result.configured) return NextResponse.json({ configured: false }, { status: 200 });
  if ("error" in result) {
    const status = result.error === "not_a_member" ? 403 : 502;
    return NextResponse.json({ configured: true, error: result.error }, { status });
  }
  return NextResponse.json({ configured: true, installation: result.installation });
}
