import { NextResponse } from "next/server";
import { getSurveyStore, listSurveys } from "@/lib/survey/survey-service";
import { jsonError } from "../../surveys/_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { reportId: string } }) {
  try {
    const surveys = await listSurveys(getSurveyStore());
    const report = surveys.flatMap((survey) => survey.reports).find((item) => item.id === params.reportId);
    if (!report) {
      return jsonError("report not found", 404);
    }

    return NextResponse.json({ report });
  } catch (error) {
    return jsonError(error);
  }
}
