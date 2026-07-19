// GET /api/portal/workspace/:slug/settings — p30-F03 治理台数据接口。
// 服务端角色裁剪落在这里：仅 owner/maintainer 拿到 200 + 数据；contributor（或非成员）
// 一律 403，响应体不含任何治理数据（binding/审批队列/andon 等）——防假阳性的核心证据：
// 未授权请求真实拿不到数据，不是拿到后由前端隐藏。
import { NextResponse } from "next/server";
import { resolveWorkspaceAccess } from "@/lib/workspace-authz";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const GOVERNANCE_ROLES = ["owner", "maintainer"] as const;

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const access = await resolveWorkspaceAccess(params.slug, req.headers, { minRoles: GOVERNANCE_ROLES });

  if (access.kind === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (access.kind === "unauthenticated") return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (access.kind === "forbidden")
    return NextResponse.json({ error: "forbidden", role: access.role }, { status: 403 });

  // F03 范围只交付准入门；治理台具体业务数据（审批队列/andon 等）仍是 UI 层 mock，
  // 归 F06/F11 等后续 feature 接真。这里只回真实的裁剪判定结果，证明服务端已放行。
  return NextResponse.json({ project: access.project, role: access.role }, { status: 200 });
}
