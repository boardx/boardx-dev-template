import { NextResponse } from "next/server";
import {
  createSurvey,
  listVisibleSurveys,
  getMembership,
  isBlank,
  type NewQuestionInput,
  type QuestionType,
  type SurveyScope,
} from "@repo/data";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-survey-001-create-survey — 问卷创建地基（P13 F01）。
// surveys / survey_questions / survey_responses 落库（team 作用域），供后续 F02-F06 复用。

const QUESTION_TYPES: QuestionType[] = ["text", "single", "multiple", "rating"];

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
    out.push({ title, type, required: obj.required === true, options });
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
    status: s.is_active ? "active" : "paused",
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
      questions?: unknown;
    };

    const title = String(body.title ?? "").trim();
    if (isBlank(title)) {
      return NextResponse.json({ errors: { title: "问卷标题不能为空" } }, { status: 400 });
    }

    const questions = parseQuestions(body.questions);
    if (questions.length === 0) {
      return NextResponse.json({ errors: { questions: "至少需要一道题目" } }, { status: 400 });
    }

    const scope: SurveyScope = body.scope === "team" ? "team" : "private";
    let teamId: number | null = null;
    if (scope === "team") {
      teamId = Number(body.teamId);
      if (!Number.isFinite(teamId)) {
        return NextResponse.json({ errors: { teamId: "team 作用域需指定所属团队" } }, { status: 400 });
      }
      if (!(await getMembership(teamId, user.id))) {
        return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
      }
    }

    const description = String(body.description ?? "").trim();
    const survey = await createSurvey(user.id, title, description, scope, teamId, questions);

    return NextResponse.json(
      {
        survey: {
          id: survey.id,
          title: survey.title,
          description: survey.description,
          scope: survey.scope,
          teamId: survey.team_id,
          status: survey.is_active ? "active" : "paused",
          responses: 0,
          questions: survey.questions,
          shareUrl: `/survey/${survey.id}/answer`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
