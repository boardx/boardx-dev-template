// approvals — W6 治理台审批队列接真（p30/F06，UC-04 owner 视角）。
//   GET ?project=slug → 真实待审 membership 列表 + SLA 倒计时（owner/maintainer/approver 可见）
// 授权判定：真实查该项目下当前登录者的 active membership，角色需 owner|maintainer|approver；
// 不满足 → 403（W6 无权限态，非 mock 视角开关能绕过）。
//
// 身份 join 键修复：曾经按 session.login 直接匹配 memberships 的 engineer_handle
// （目录里的展示用自然键），与 p30/F03 修复前的漏洞同一根因——handle 与 github_login
// 是两个独立字段，可以不相等；退回按 handle 匹配会让「handle 恰好等于某个真实用户
// github_login」的人继承其 membership。现在统一走 findEngineerByGithubLogin()
// 解出 engineer_id 后按 engineer_id 匹配，与 lib/workspace-authz.ts 同一套纪律。
// findEngineerByGithubLogin 返回判别联合（#807）：!lookup.ok 是上游目录读面本身
// 打不通，与「查无此人」是两回事，不得都折叠成 403（会把基础设施问题伪装成鉴权结论）。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { directoryReadConfigured, findEngineerByGithubLogin, listProjectMemberships } from "@/lib/directory";

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

  const lookup = await findEngineerByGithubLogin(session.login);
  if (!lookup.ok) return NextResponse.json({ configured: true, error: "unreachable" }, { status: 502 });
  const engineer = lookup.engineer;
  const mine = engineer ? memberships.find((m) => m.engineer_id === engineer.engineer_id && m.status === "active") : undefined;
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
