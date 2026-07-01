import { NextResponse } from "next/server";
import {
  deleteSurveyQuestion,
  getSurveyStore,
  updateSurveyQuestion,
} from "@/lib/survey/survey-service";
import { jsonError } from "../../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { surveyId: string; questionId: string } }
) {
  try {
    const body = (await req.json()) as Parameters<typeof updateSurveyQuestion>[3];
    const question = await updateSurveyQuestion(
      getSurveyStore(),
      params.surveyId,
      params.questionId,
      body
    );
    return NextResponse.json({ question });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { surveyId: string; questionId: string } }
) {
  try {
    const survey = await deleteSurveyQuestion(getSurveyStore(), params.surveyId, params.questionId);
    return NextResponse.json({ survey });
  } catch (error) {
    return jsonError(error);
  }
}
