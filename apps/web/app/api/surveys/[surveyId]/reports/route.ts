import { NextResponse } from "next/server";
import { generateSurveyReport, getSurvey, getSurveyStore } from "@/lib/survey/survey-service";
import { jsonError } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const survey = await getSurvey(getSurveyStore(), params.surveyId);
    if (!survey) {
      return jsonError("survey not found", 404);
    }

    return NextResponse.json({ reports: survey.reports });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const report = await generateSurveyReport(getSurveyStore(), params.surveyId);
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
