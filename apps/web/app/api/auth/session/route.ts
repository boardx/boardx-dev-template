import { NextResponse } from "next/server";
import { currentUser, toPublicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ user: user ? toPublicUser(user) : null });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
