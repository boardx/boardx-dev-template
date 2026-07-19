// approvals — W6 治理台审批队列接真（p30/F06，UC-04 owner 视角）。
//   GET ?project=slug → 真实待审 membership 列表 + SLA 倒计时（owner/maintainer/approver 可见）
// 授权判定：真实查该项目下当前登录者的 active membership，角色需 owner|maintainer|approver；
// 不满足 → 403（W6 无权限态，非 mock 视角开关能绕过）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { directoryReadConfigured, listProjectMemberships } from "@/lib/directory";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const APPROVER_ROLES = new Set(["owner", "maintainer", "approver"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  if (!project) return NextResponse.json({ error: "missing_project" }, { status: 400 });

  const session = await getSessionUser(req.headers);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  if (!directoryReadConfigured()) return NextResponse.json({ configured: false });

  const memberships = await listProjectMemberships(project);
  if (memberships === null) return NextResponse.json({ configured: true, error: "unreachable" }, { status: 502 });

  const handle = session.login.toLowerCase();
  const mine = memberships.find((m) => m.engineer_handle === handle && m.status === "active");
  if (!mine || !APPROVER_ROLES.has(mine.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const pending = memberships
    .filter((m) => m.status === "pending")
    .map((m) => ({
      membership_id: m.membership_id,
      handle: m.engineer_handle,
      role: m.role,
      modules: m.modules,
      intro: m.intro,
      created_at: m.created_at,
      sla: m.sla ?? null,
    }));

  return NextResponse.json({ configured: true, items: pending });
}
