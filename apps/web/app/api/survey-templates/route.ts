import { NextResponse } from "next/server";
import {
  createSurveyTemplate,
  getMembership,
  isBlank,
  listVisibleSurveyTemplates,
  type NewQuestionInput,
  type QuestionType,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUESTION_TYPES: QuestionType[] = ["text", "single", "multiple", "rating"];

function parseQuestions(raw: unknown): NewQuestionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: NewQuestionInput[] = [];
  for (const item of raw) {
    const obj = (item ?? {}) as Record<string, unknown>;
    const title = String(obj.title ?? "").trim();
    if (isBlank(title)) continue;
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
  return NextResponse.json({ templates: await listVisibleSurveyTemplates(user.id) });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json()) as {
      title?: unknown;
      description?: unknown;
      teamId?: unknown;
      questions?: unknown;
    };

    const title = String(body.title ?? "").trim();
    if (isBlank(title)) {
      return NextResponse.json({ errors: { title: "模板名称不能为空" } }, { status: 400 });
    }

    const teamId = Number(body.teamId);
    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ errors: { teamId: "团队模板需指定所属团队" } }, { status: 400 });
    }
    if (!(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
    }

    const questions = parseQuestions(body.questions);
    if (questions.length === 0) {
      return NextResponse.json({ errors: { questions: "至少需要一道题目" } }, { status: 400 });
    }

    const template = await createSurveyTemplate({
      ownerId: user.id,
      teamId,
      title,
      description: String(body.description ?? "").trim(),
      questions,
    });

    return NextResponse.json({ template: { ...template, can_delete: true } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
