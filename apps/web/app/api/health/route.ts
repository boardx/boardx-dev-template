import { NextResponse } from "next/server";
import { healthPayload } from "@/lib/health";

export function GET() {
  return NextResponse.json(healthPayload());
}
