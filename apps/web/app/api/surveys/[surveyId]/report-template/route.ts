import { NextResponse } from "next/server";
import {
  generateSurveyReportTemplate,
  getSurvey,
  getSurveyStore,
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

    return NextResponse.json({ reportTemplate: survey.reportTemplate ?? null });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const reportTemplate = await generateSurveyReportTemplate(getSurveyStore(), params.surveyId);
    return NextResponse.json({ reportTemplate });
  } catch (error) {
    return jsonError(error);
  }
}
