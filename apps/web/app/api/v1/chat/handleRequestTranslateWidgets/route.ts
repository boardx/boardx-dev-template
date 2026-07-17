import { NextResponse } from "next/server";
import {
  legacyErrorResponse,
  readLegacyJson,
  runLegacyTranslation,
  type LegacyAvaTranslateRequest,
} from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await readLegacyJson<LegacyAvaTranslateRequest>(request);
    return NextResponse.json({ result: await runLegacyTranslation(data), targetLanguage: data.targetLanguage ?? "en" });
  } catch (error) {
    console.error(error);
    return legacyErrorResponse("AVA translation request failed");
  }
}
