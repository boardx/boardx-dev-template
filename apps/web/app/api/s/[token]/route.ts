import { NextResponse } from "next/server";
import { getSurveyByToken, getSurveyStore } from "@/lib/survey/survey-service";
import { jsonError } from "../../surveys/_utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  try {
    const result = await getSurveyByToken(getSurveyStore(), params.token);
    if (!result) {
      return jsonError("share link not found", 404);
    }

    return NextResponse.json({ survey: result.record, shareLink: result.shareLink });
  } catch (error) {
    return jsonError(error);
  }
}
