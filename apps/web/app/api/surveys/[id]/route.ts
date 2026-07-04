import { NextResponse } from "next/server";
import {
  canManageSurveyScope,
  canViewSurvey,
  deleteSurvey,
  deleteSurveyById,
  getSurvey,
  getSurveyWithQuestions,
  isBlank,
  updateSurvey,
  updateSurveyById,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const surveyId = Number(raw);
  return Number.isFinite(surveyId) ? surveyId : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const survey = await getSurveyWithQuestions(surveyId);
  if (!survey) return NextResponse.json({ error: "not found" }, { status: 404 });
  const canManage = await canManageSurveyScope(surveyId, user.id);
  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      scope: survey.scope,
      teamId: survey.team_id,
      roomId: survey.room_id,
      status: survey.is_active ? "active" : "paused",
      updatedAt: survey.updated_at,
      isOwner: Number(survey.owner_user_id) === Number(user.id),
      // p20/F08：room 问卷的管理按钮由房间角色（owner/admin）决定，不再等同于 isOwner
      // （问卷创建者与管理者在 room 作用域下可能是不同人）。
      canManage,
      shareUrl: `/survey/${survey.id}/answer`,
      questions: survey.questions,
    },
  });
}

/**
 * PATCH/DELETE 管理权判定统一走 canManageSurveyScope（p20/F08 uc-rr-007）：
 * - room 问卷：房间 owner/admin。
 * - private/team 问卷：仍然只有问卷 owner_user_id 本人——房间角色对团队问卷发起的管理请求，
 *   canManageSurveyScope 在这里会返回 false（它只认问卷 owner_user_id，不认房间角色），
 *   从而如既有契约一样 403，不会被房间管理权越权放行。
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const surveyId = parseSurveyId(params.id);
    if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
    const existing = await getSurvey(surveyId);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageSurveyScope(surveyId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fields: { title?: string; description?: string; isActive?: boolean } = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (isBlank(title)) return NextResponse.json({ errors: { title: "问卷标题不能为空" } }, { status: 400 });
      fields.title = title;
    }
    if (body.description !== undefined) fields.description = String(body.description ?? "").trim();
    if (body.isActive !== undefined) fields.isActive = body.isActive === true;

    const survey =
      existing.scope === "room" ? await updateSurveyById(surveyId, fields) : await updateSurvey(surveyId, user.id, fields);
    if (!survey) return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    return NextResponse.json({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        scope: survey.scope,
        teamId: survey.team_id,
        roomId: survey.room_id,
        status: survey.is_active ? "active" : "paused",
        updatedAt: survey.updated_at,
        isOwner: Number(survey.owner_user_id) === Number(user.id),
        canManage: true,
        shareUrl: `/survey/${survey.id}/answer`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const surveyId = parseSurveyId(params.id);
    if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
    const existing = await getSurvey(surveyId);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!(await canManageSurveyScope(surveyId, user.id))) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }

    const deleted =
      existing.scope === "room" ? await deleteSurveyById(surveyId) : await deleteSurvey(surveyId, user.id);
    if (!deleted) return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
