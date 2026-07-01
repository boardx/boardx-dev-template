import { NextResponse } from "next/server";
import {
  deleteSurvey,
  getSurvey,
  getSurveyStore,
  updateSurvey,
} from "@/lib/survey/survey-service";
import { jsonError } from "../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const survey = await getSurvey(getSurveyStore(), params.surveyId);
    if (!survey) {
      return jsonError("survey not found", 404);
    }

    return NextResponse.json({ survey });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const body = (await req.json()) as Parameters<typeof updateSurvey>[2];
    const survey = await updateSurvey(getSurveyStore(), params.surveyId, body);
    return NextResponse.json({ survey });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    await deleteSurvey(getSurveyStore(), params.surveyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
