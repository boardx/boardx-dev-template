import { NextResponse } from "next/server";
import { validateRegister, normalizeEmail, hashPassword } from "@repo/auth";
import { createUser, findUserByEmail } from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const input = {
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      agreeTerms: body.agreeTerms === true,
    };
    const errors = validateRegister(input);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    const email = normalizeEmail(input.email);
    if (await findUserByEmail(email)) {
      return NextResponse.json({ errors: { email: "该邮箱已注册" } }, { status: 409 });
    }
    const user = await createUser({
      email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
    });
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
