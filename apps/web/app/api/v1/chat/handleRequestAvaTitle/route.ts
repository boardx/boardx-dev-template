import { NextResponse } from "next/server";
import {
  buildLegacyTitle,
  buildLegacyWidgetPrompt,
  legacyErrorResponse,
  readLegacyJson,
  type LegacyAvaWidgetRequest,
} from "@/lib/ava-legacy-compat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const data = await readLegacyJson<LegacyAvaWidgetRequest>(request);
    return NextResponse.json({ title: buildLegacyTitle(buildLegacyWidgetPrompt(data)) });
  } catch (error) {
    console.error(error);
    return legacyErrorResponse("AVA title request failed");
  }
}
