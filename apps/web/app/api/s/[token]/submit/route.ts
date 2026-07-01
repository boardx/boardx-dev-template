import { NextResponse } from "next/server";
import {
  getSurveyByToken,
  getSurveyStore,
  submitSurveyResponse,
  type SubmitSurveyResponseInput,
} from "@/lib/survey/survey-service";
import { jsonError } from "../../../surveys/_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const survey = await getSurveyByToken(getSurveyStore(), params.token);
    if (!survey) {
      return jsonError("share link not found", 404);
    }

    const body = (await req.json()) as SubmitSurveyResponseInput;
    if (!Array.isArray(body.answers)) {
      return jsonError("answers 必须是数组", 400);
    }

    const response = await submitSurveyResponse(getSurveyStore(), params.token, body);
    return NextResponse.json({ response }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
