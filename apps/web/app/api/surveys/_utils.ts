import { NextResponse } from "next/server";

export function jsonError(error: unknown, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : String(error) },
    { status }
  );
}

export function requireString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
