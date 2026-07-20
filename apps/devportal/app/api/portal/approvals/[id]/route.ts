// approvals/:id — W6 批准/驳回真实调用（p30/F06）。
//   POST { project, action: "approve" | "reject" } → 校验 owner/maintainer/approver 资格
//   → 目录状态迁移（入只增审计，directory.membership.transitioned）→ best-effort 回写 onboarding issue。
//
// 身份 join 键修复：这是写路径（批准/驳回真实改变 membership 状态），曾经按
// session.login 直接匹配 engineer_handle——与 p30/F03 修复前的漏洞同一根因，且这里
// 后果更重（写路径权限提升：handle 恰好等于某个真实 owner/maintainer github_login 的
// 人，能以其身份批准/驳回他人的加入申请）。现在统一走 findEngineerByGithubLogin()
// 解出 engineer_id 后按 engineer_id 匹配。
// findEngineerByGithubLogin 返回判别联合（#807）：!lookup.ok 是上游目录读面本身
// 打不通，与「查无此人」是两回事，不得都折叠成 403。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { directoryWriteConfigured, findEngineerByGithubLogin, listProjectMemberships, transitionMembership } from "@/lib/directory";
import { commentOnboardingIssue, sanitizeInline } from "@/lib/onboarding-issue";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const APPROVER_ROLES = new Set(["owner", "maintainer", "approver"]);
const ACTIONS = new Set(["approve", "reject"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionUser(req.headers);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { project?: unknown; action?: unknown };
  const project = typeof body.project === "string" ? body.project : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!project) return NextResponse.json({ error: "missing_project" }, { status: 400 });
  if (!ACTIONS.has(action)) return NextResponse.json({ error: "invalid_action" }, { status: 422 });

  const memberships = await listProjectMemberships(project);
  if (memberships === null) return NextResponse.json({ error: "directory_unreachable" }, { status: 502 });

  const lookup = await findEngineerByGithubLogin(session.login);
  if (!lookup.ok) return NextResponse.json({ error: "directory_unreachable" }, { status: 502 });
  const mine = lookup.engineer ? memberships.find((m) => m.engineer_id === lookup.engineer!.engineer_id && m.status === "active") : undefined;
  if (!mine || !APPROVER_ROLES.has(mine.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!directoryWriteConfigured()) return NextResponse.json({ error: "directory_not_configured" }, { status: 503 });

  const target = memberships.find((m) => m.membership_id === params.id);
  if (!target) return NextResponse.json({ error: "membership_not_found" }, { status: 404 });

  const result = await transitionMembership(params.id, action as "approve" | "reject", `devportal:${session.login}`);
  if (!result.ok) {
    return NextResponse.json({ error: "transition_failed", detail: result.error }, { status: result.status === 409 ? 409 : 502 });
  }

  if (target.onboarding_issue_url) {
    const verdict = action === "approve" ? "✓ 已批准（初始 Probation）" : "✗ 已驳回";
    // session.login 来自 GitHub OAuth（GitHub 用户名字符集本身就窄），但拼进 issue 评论前
    // 仍统一过 sanitizeInline——防御纵深，不依赖上游身份提供方的字符集假设。
    await commentOnboardingIssue(
      target.onboarding_issue_url,
      `${verdict} · by @${sanitizeInline(session.login)} · 已入只增审计（directory.membership.transitioned）`,
    );
  }

  return NextResponse.json({ membership: result.membership });
}
