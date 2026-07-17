import { NextResponse } from "next/server";
import {
  canManageTeam,
  generateToken,
  expiresAt,
  isValidEmail,
  normalizeEmail,
  TEAM_INVITE_TTL_MS,
} from "@repo/auth";
import {
  getMembership,
  findUserByEmail,
  addMember,
  createTeamInvite,
} from "@repo/data";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 邮箱邀请成员（uc-team-003）。
 * POST { teamId, email }
 *  - 已注册且不在团队 → 直接加入为 member（status: "added"）。
 *  - 已注册且已在团队 → userAlreadyInTeam（409）。
 *  - 未注册邮箱 → 生成邀请 token + 链接（status: "invited"）。
 */
export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      teamId?: unknown;
      email?: unknown;
    };
    const teamId = Number(body.teamId);
    if (!Number.isFinite(teamId)) {
      return NextResponse.json({ error: "缺少 teamId" }, { status: 400 });
    }

    // 仅 owner/admin 可邀请
    if (!canManageTeam(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "无权限邀请" }, { status: 403 });
    }

    const rawEmail = String(body.email ?? "").trim();
    if (!rawEmail) {
      return NextResponse.json({ error: "请输入邮箱地址" }, { status: 400 });
    }
    if (!isValidEmail(rawEmail)) {
      return NextResponse.json({ error: "invalidEmail" }, { status: 400 });
    }
    const email = normalizeEmail(rawEmail);

    const existing = await findUserByEmail(email);
    if (existing) {
      if (await getMembership(teamId, existing.id)) {
        return NextResponse.json({ error: "userAlreadyInTeam" }, { status: 409 });
      }
      await addMember(teamId, existing.id, "member");
      return NextResponse.json({ status: "added", email }, { status: 200 });
    }

    // 未注册邮箱：按邀请流程处理，生成一次性 token（可用于邀请链接）
    const token = generateToken();
    await createTeamInvite(token, teamId, "member", expiresAt(TEAM_INVITE_TTL_MS));
    return NextResponse.json({ status: "invited", email, token }, { status: 200 });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
