import { NextResponse } from "next/server";
import {
  canManageSurveyScope,
  canViewSurvey,
  deleteSurvey,
  deleteSurveyById,
  getSurvey,
  getSurveyWithQuestions,
  ensureSurveyReportTemplate,
  isBlank,
  updateSurvey,
  updateSurveyById,
  replaceSurveyQuestions,
  type NewQuestionInput,
  type QuestionType,
  type SurveyUpdateFields,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const surveyId = Number(raw);
  return Number.isFinite(surveyId) ? surveyId : null;
}

const QUESTION_TYPES: QuestionType[] = [
  "short_text", "text", "email", "number", "phone", "single", "multiple", "dropdown",
  "rating", "linear_scale", "nps", "date", "time", "file",
];

function parseQuestions(raw: unknown): NewQuestionInput[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const title = String(value.title ?? "").trim();
    if (!title) return [];
    const type = QUESTION_TYPES.includes(value.type as QuestionType) ? value.type as QuestionType : "text";
    const options = Array.isArray(value.options)
      ? value.options.map((option) => String(option ?? "").trim()).filter(Boolean)
      : [];
    const category = String(value.category ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
    return [{ title, type, required: value.required === true, options, ...(category ? { category } : {}) }];
  });
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
  const reportTemplate = await ensureSurveyReportTemplate(survey.id, survey.title);
  return NextResponse.json({
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      scope: survey.scope,
      teamId: survey.team_id,
      roomId: survey.room_id,
      status: survey.is_active ? "active" : "paused",
      responseMode: survey.response_mode,
      publishStartAt: survey.publish_start_at,
      publishEndAt: survey.publish_end_at,
      responseLimit: survey.response_limit,
      oneResponsePerUser: survey.one_response_per_user,
      confirmationMessage: survey.confirmation_message,
      updatedAt: survey.updated_at,
      isOwner: Number(survey.owner_user_id) === Number(user.id),
      // p20/F08：room 问卷的管理按钮由房间角色（owner/admin）决定，不再等同于 isOwner
      // （问卷创建者与管理者在 room 作用域下可能是不同人）。
      canManage,
      shareUrl: `/survey/${survey.id}/answer`,
      questions: survey.questions,
      reportTemplate,
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
    const fields: SurveyUpdateFields = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (isBlank(title)) return NextResponse.json({ errors: { title: "问卷标题不能为空" } }, { status: 400 });
      fields.title = title;
    }
    if (body.description !== undefined) fields.description = String(body.description ?? "").trim();
    if (body.isActive !== undefined) fields.isActive = body.isActive === true;
    if (body.responseMode !== undefined) {
      if (body.responseMode !== "anonymous" && body.responseMode !== "identified") {
        return NextResponse.json({ errors: { responseMode: "答题模式无效" } }, { status: 400 });
      }
      fields.responseMode = body.responseMode;
    }
    if (body.publishStartAt !== undefined) fields.publishStartAt = body.publishStartAt ? String(body.publishStartAt) : null;
    if (body.publishEndAt !== undefined) fields.publishEndAt = body.publishEndAt ? String(body.publishEndAt) : null;
    if (body.responseLimit !== undefined) {
      const limit = body.responseLimit == null || body.responseLimit === "" ? null : Number(body.responseLimit);
      if (limit !== null && (!Number.isInteger(limit) || limit <= 0)) {
        return NextResponse.json({ errors: { responseLimit: "答卷上限必须是正整数" } }, { status: 400 });
      }
      fields.responseLimit = limit;
    }
    if (body.oneResponsePerUser !== undefined) fields.oneResponsePerUser = body.oneResponsePerUser === true;
    if (body.confirmationMessage !== undefined) fields.confirmationMessage = String(body.confirmationMessage ?? "").trim();
    const questions = parseQuestions(body.questions);
    if (questions && questions.length === 0) {
      return NextResponse.json({ errors: { questions: "至少需要一道题目" } }, { status: 400 });
    }

    const survey =
      existing.scope === "room" ? await updateSurveyById(surveyId, fields) : await updateSurvey(surveyId, user.id, fields);
    if (!survey) return NextResponse.json({ error: "无管理权限" }, { status: 403 });
    const savedQuestions = questions ? await replaceSurveyQuestions(surveyId, questions) : undefined;
    const reportTemplate = await ensureSurveyReportTemplate(survey.id, survey.title);
    return NextResponse.json({
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        scope: survey.scope,
        teamId: survey.team_id,
        roomId: survey.room_id,
        status: survey.is_active ? "active" : "paused",
        responseMode: survey.response_mode,
        publishStartAt: survey.publish_start_at,
        publishEndAt: survey.publish_end_at,
        responseLimit: survey.response_limit,
        oneResponsePerUser: survey.one_response_per_user,
        confirmationMessage: survey.confirmation_message,
        updatedAt: survey.updated_at,
        isOwner: Number(survey.owner_user_id) === Number(user.id),
        canManage: true,
        shareUrl: `/survey/${survey.id}/answer`,
        questions: savedQuestions,
        reportTemplate,
      },
    });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
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
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
