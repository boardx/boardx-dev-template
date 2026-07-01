import { NextResponse } from "next/server";
import {
  addSurveyQuestion,
  getSurvey,
  getSurveyStore,
  type AddQuestionInput,
} from "@/lib/survey/survey-service";
import { jsonError } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const survey = await getSurvey(getSurveyStore(), params.surveyId);
    if (!survey) {
      return jsonError("survey not found", 404);
    }

    return NextResponse.json({ questions: survey.questions });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const body = (await req.json()) as AddQuestionInput;
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return jsonError("title 必填", 400);
    }

    const question = await addSurveyQuestion(getSurveyStore(), params.surveyId, body);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
