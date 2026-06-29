import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 社交登录骨架（uc-auth-003）：本轮不接真 OAuth（需 provider secret）。
// 返回 501 + 结构化提示；接入时在此实现各 provider 的授权跳转/回调。
export function GET(_req: Request, { params }: { params: { provider: string } }) {
  return NextResponse.json(
    { error: "社交登录待接入", provider: params.provider, deferred: true },
    { status: 501 }
  );
}
