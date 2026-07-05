import { NextResponse } from "next/server";
import { normalizeEmail } from "@repo/auth";
import { createUser, findUserByEmail } from "@repo/data";
import { startSession, toPublicUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 第三方登录（uc-auth-003）—— STUB：不实现真实 OAuth。
// 点击某 provider 即视为该第三方认证成功；系统按 provider 创建/复用一个 demo 用户，
// 并用与邮箱登录相同的机制（lib/session.startSession）建立会话。
//
// 安全修复（p21 F01 / issue #373）：此前无任何生产环境保护——只要 provider 在白名单内，
// 任何人 POST 一下就能免密创建/登录一个真实账号，等于一个公开的认证后门。这里的 demo
// 登录桩只应该在开发/测试环境存在（供 e2e 使用），生产环境必须整体拒绝，直到接入真实
// OAuth 校验为止。写法对齐同目录 apps/web/app/api/dev/reset-token/route.ts 的生产环境 gate。
const SUPPORTED = new Set(["google", "facebook", "wechat"]);

// 每个 provider 对应一个稳定的 demo 邮箱：首次登录建用户记录，后续复用同一记录。
function demoEmail(provider: string): string {
  return normalizeEmail(`${provider}.demo@social.boardx.local`);
}

function demoNames(provider: string): { firstName: string; lastName: string } {
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);
  return { firstName: label, lastName: "User" };
}

export async function POST(req: Request) {
  // 生产环境一律拒绝：demo 登录桩不代表真实身份校验，绝不能在生产环境里被当成
  // 一条免密登录通道。真实 OAuth 接入之前，生产环境下这个能力整体关闭。
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const body = (await req.json()) as { provider?: unknown };
    const provider = String(body.provider ?? "").toLowerCase().trim();

    // 未启用/未知 provider：拒绝，用户保持未登录（UC 失败出口）。
    if (!SUPPORTED.has(provider)) {
      return NextResponse.json({ error: "该第三方登录暂不可用" }, { status: 400 });
    }

    const email = demoEmail(provider);

    // A1：邮箱已存在则复用已有用户记录；否则新建（生成用户记录）。
    let user = await findUserByEmail(email);
    if (!user) {
      const { firstName, lastName } = demoNames(provider);
      user = await createUser({
        email,
        passwordHash: null, // 第三方用户无本地密码
        firstName,
        lastName,
        provider,
      });
    }

    // 与邮箱登录相同的会话机制。
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    // E4：无法创建/读取用户等异常 —— 用户保持未登录。
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
