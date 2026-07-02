import { NextResponse } from "next/server";
import {
  canViewSurvey,
  deleteSurvey,
  getSurvey,
  getSurveyWithQuestions,
  isBlank,
  updateSurvey,
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
  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      scope: survey.scope,
      teamId: survey.team_id,
      status: survey.is_active ? "active" : "paused",
      updatedAt: survey.updated_at,
      isOwner: Number(survey.owner_user_id) === Number(user.id),
      shareUrl: `/survey/${survey.id}/answer`,
      questions: survey.questions,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const surveyId = parseSurveyId(params.id);
    if (surveyId == null) return NextResponse.json({ error: "surveyId 无效" }, { status: 400 });
    const existing = await getSurvey(surveyId);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (Number(existing.owner_user_id) !== Number(user.id)) {
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

    const survey = await updateSurvey(surveyId, user.id, fields);
    if (!survey) return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    return NextResponse.json({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        scope: survey.scope,
        teamId: survey.team_id,
        status: survey.is_active ? "active" : "paused",
        updatedAt: survey.updated_at,
        isOwner: true,
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
    if (Number(existing.owner_user_id) !== Number(user.id)) {
      return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    }

    const deleted = await deleteSurvey(surveyId, user.id);
    if (!deleted) return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
