import { NextResponse } from "next/server";
import {
  createSurvey,
  defaultSurveyReportTemplate,
  ensureSurveyReportTemplate,
  listVisibleSurveys,
  getMembership,
  getRoomRole,
  isBlank,
  type NewQuestionInput,
  type QuestionType,
  type SurveyReportTemplateInput,
  type SurveyScope,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-survey-001-create-survey — 问卷创建地基（P13 F01）。
// surveys / survey_questions / survey_responses 落库（team 作用域），供后续 F02-F06 复用。

const QUESTION_TYPES: QuestionType[] = [
  "short_text", "text", "email", "number", "phone", "single", "multiple", "dropdown",
  "rating", "linear_scale", "nps", "date", "time", "file",
];

function parseReportTemplate(raw: unknown, surveyTitle: string): SurveyReportTemplateInput {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const fallback = defaultSurveyReportTemplate(surveyTitle);
  const list = (value: unknown, defaultValue: string[]) => Array.isArray(value)
    ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean)
    : defaultValue;
  const sections = list(item.sections, fallback.sections);
  return {
    title: String(item.title ?? fallback.title).trim() || fallback.title,
    sections: Array.from(new Set(["样本概览", "关键指标", ...sections])),
    metrics: list(item.metrics, fallback.metrics),
    chartSlots: list(item.chartSlots, fallback.chartSlots),
    caveats: list(item.caveats, fallback.caveats),
  };
}

function parseQuestions(raw: unknown): NewQuestionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: NewQuestionInput[] = [];
  for (const item of raw) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const title = String(obj.title ?? "").trim();
    if (isBlank(title)) continue; // 空标题的题目不计入有效题（不落库）
    const type = QUESTION_TYPES.includes(obj.type as QuestionType) ? (obj.type as QuestionType) : "text";
    const options = Array.isArray(obj.options)
      ? obj.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : [];
    const category = String(obj.category ?? "").trim().replace(/\s+/g, " ").slice(0, 24);
    out.push({ title, type, required: obj.required === true, options, ...(category ? { category } : {}) });
  }
  return out;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const surveys = await listVisibleSurveys(user.id, currentTeamId());
  const withCounts = surveys.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    scope: s.scope,
    teamId: s.team_id,
    // p20/F08：room 问卷附带 roomId/roomName，供全局列表页展示 scope 徽章 + 所属房间名。
    roomId: s.room_id,
    roomName: s.room_name ?? null,
    status: s.is_active ? "active" : "paused",
    responseMode: s.response_mode,
    publishStartAt: s.publish_start_at,
    publishEndAt: s.publish_end_at,
    responseLimit: s.response_limit,
    oneResponsePerUser: s.one_response_per_user,
    confirmationMessage: s.confirmation_message,
    responses: Number(s.response_count ?? 0),
    updatedAt: s.updated_at,
    isOwner: Number(s.owner_user_id) === Number(user.id),
    shareUrl: `/survey/${s.id}/answer`,
  }));
  return NextResponse.json({ surveys: withCounts });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json()) as {
      title?: unknown;
      description?: unknown;
      scope?: unknown;
      teamId?: unknown;
      roomId?: unknown;
      questions?: unknown;
      reportTemplate?: unknown;
    };

    const title = String(body.title ?? "").trim();
    if (isBlank(title)) {
      return NextResponse.json({ errors: { title: "问卷标题不能为空" } }, { status: 400 });
    }

    const questions = parseQuestions(body.questions);
    if (questions.length === 0) {
      return NextResponse.json({ errors: { questions: "至少需要一道题目" } }, { status: 400 });
    }

    const scope: SurveyScope = body.scope === "team" ? "team" : body.scope === "room" ? "room" : "private";
    let teamId: number | null = null;
    let roomId: number | null = null;
    if (scope === "team") {
      teamId = Number(body.teamId);
      if (!Number.isFinite(teamId)) {
        return NextResponse.json({ errors: { teamId: "team 作用域需指定所属团队" } }, { status: 400 });
      }
      if (!(await getMembership(teamId, user.id))) {
        return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
      }
    } else if (scope === "room") {
      // p20/F08：room 作用域创建走这个通用端点是为了复用 p13 创建器本体（编辑器/题型/校验）；
      // 权限判定完全基于房间角色（owner/admin），与团队问卷的 getMembership 分支互不影响。
      roomId = Number(body.roomId);
      if (!Number.isFinite(roomId)) {
        return NextResponse.json({ errors: { roomId: "room 作用域需指定所属房间" } }, { status: 400 });
      }
      const role = await getRoomRole(roomId, user.id);
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json({ error: "无权限在该房间创建问卷" }, { status: 403 });
      }
    }

    const description = String(body.description ?? "").trim();
    const survey = await createSurvey(user.id, title, description, scope, teamId, questions, roomId);
    const reportTemplate = await ensureSurveyReportTemplate(
      survey.id,
      survey.title,
      parseReportTemplate(body.reportTemplate, survey.title)
    );

    return NextResponse.json(
      {
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
          responses: 0,
          questions: survey.questions,
          shareUrl: `/survey/${survey.id}/answer`,
          reportTemplate,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
