import { NextResponse } from "next/server";
import { listSurveyTemplates } from "@/lib/survey/survey-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ templates: listSurveyTemplates() });
}
