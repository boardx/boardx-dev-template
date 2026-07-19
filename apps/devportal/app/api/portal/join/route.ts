// join — P2 招募页「加入这个项目」向导接真（p30/F06，UC-04）。
//   GET  ?project=slug → 当前登录者在该项目的 membership 现状（未登录/未配置/无申请/pending+SLA/已是成员）
//   POST { project, role, modules, intro } → 提交加入申请：pending + 真实 SLA 倒计时 +
//         自动开 onboarding issue（GitHub 双写，N5，best-effort，未配置写 token 时诚实降级不阻断）
// 门禁：GitHub 登录（F02 session，OAuth 优先 / Access 回退）。公开层没有登录 = 直接 401，
// 前端据此显式提示「请先登录」，不假装能工作。
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  directoryReadConfigured,
  directoryWriteConfigured,
  findProjectBySlug,
  getMembershipSla,
  listProjectMemberships,
  requestMembership,
  upsertEngineerFromSession,
} from "@/lib/directory";
import { openOnboardingIssue } from "@/lib/onboarding-issue";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["contributor", "approver", "maintainer"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  if (!project) return NextResponse.json({ error: "missing_project" }, { status: 400 });

  const session = await getSessionUser(req.headers);
  if (!session) return NextResponse.json({ logged_in: false });

  if (!directoryReadConfigured()) return NextResponse.json({ logged_in: true, handle: session.login, configured: false });

  const memberships = await listProjectMemberships(project);
  if (memberships === null) return NextResponse.json({ logged_in: true, handle: session.login, configured: true, error: "unreachable" });

  const handle = session.login.toLowerCase();
  const mine = memberships.find((m) => m.engineer_handle === handle);
  if (!mine) return NextResponse.json({ logged_in: true, handle, configured: true, membership: null });

  const sla = mine.status === "pending" ? (await getMembershipSla(mine.membership_id))?.sla ?? mine.sla ?? null : null;
  return NextResponse.json({
    logged_in: true,
    handle,
    configured: true,
    membership: {
      membership_id: mine.membership_id,
      status: mine.status,
      role: mine.role,
      sla,
      onboarding_issue_url: mine.onboarding_issue_url,
    },
  });
}

export async function POST(req: Request) {
  const session = await getSessionUser(req.headers);
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    project?: unknown;
    role?: unknown;
    modules?: unknown;
    intro?: unknown;
  };
  const project = typeof body.project === "string" ? body.project : "";
  const role = typeof body.role === "string" ? body.role : "";
  const modules = Array.isArray(body.modules) ? body.modules.filter((m): m is string => typeof m === "string") : [];
  const intro = typeof body.intro === "string" ? body.intro : "";

  if (!project) return NextResponse.json({ error: "missing_project" }, { status: 400 });
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "invalid_role" }, { status: 422 });
  if (modules.length === 0) return NextResponse.json({ error: "missing_modules" }, { status: 422 });
  if (intro.trim().length < 8) return NextResponse.json({ error: "intro_too_short" }, { status: 422 });

  if (!directoryWriteConfigured()) return NextResponse.json({ error: "directory_not_configured" }, { status: 503 });

  const projectRow = await findProjectBySlug(project);
  if (!projectRow) return NextResponse.json({ error: "unknown_project" }, { status: 404 });

  const upserted = await upsertEngineerFromSession(session.login, session.name);
  if (!upserted.ok) return NextResponse.json({ error: "engineer_upsert_failed", detail: upserted.error }, { status: 502 });

  // GitHub 双写（N5）：best-effort，先开 issue 再带着 url 落 membership（未配置写 token 时
  // openOnboardingIssue 返回 configured:false，url 为 null——申请仍然继续，不因此阻断）。
  const issue = await openOnboardingIssue({
    projectSlug: project,
    projectName: projectRow.name,
    handle: upserted.engineer.handle,
    role,
    modules,
    intro,
  });

  const result = await requestMembership({
    project,
    engineer: upserted.engineer.handle,
    role,
    modules,
    intro,
    onboardingIssueUrl: issue.url,
    actor: `devportal:${session.login}`,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json({ error: "membership_exists", detail: result.error }, { status: 409 });
    }
    return NextResponse.json({ error: "join_failed", detail: result.error }, { status: 502 });
  }

  const sla = await getMembershipSla(result.membership.membership_id);
  return NextResponse.json(
    {
      membership: result.membership,
      sla: sla?.sla ?? null,
      onboarding_issue: { configured: issue.configured, url: issue.url },
    },
    { status: 201 },
  );
}
