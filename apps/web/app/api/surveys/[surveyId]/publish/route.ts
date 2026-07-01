import { NextResponse } from "next/server";
import { getSurveyStore, publishSurvey } from "@/lib/survey/survey-service";
import { jsonError } from "../../_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { surveyId: string } }) {
  try {
    const result = await publishSurvey(getSurveyStore(), params.surveyId);
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
