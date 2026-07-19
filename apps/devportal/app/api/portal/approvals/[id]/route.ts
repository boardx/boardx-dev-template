// approvals/:id — W6 批准/驳回真实调用（p30/F06）。
//   POST { project, action: "approve" | "reject" } → 校验 owner/maintainer/approver 资格
//   → 目录状态迁移（入只增审计，directory.membership.transitioned）→ best-effort 回写 onboarding issue。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { directoryWriteConfigured, listProjectMemberships, transitionMembership } from "@/lib/directory";
import { commentOnboardingIssue } from "@/lib/onboarding-issue";

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

  const handle = session.login.toLowerCase();
  const mine = memberships.find((m) => m.engineer_handle === handle && m.status === "active");
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
    await commentOnboardingIssue(
      target.onboarding_issue_url,
      `${verdict} · by @${session.login} · 已入只增审计（directory.membership.transitioned）`,
    );
  }

  return NextResponse.json({ membership: result.membership });
}
