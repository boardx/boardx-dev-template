import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── In-memory 邀请令牌存根（STUB）─────────────────────────────────────────────
// uc-invite-001：本 feature 只处理「接受邀请链接」主流程。真实的邀请创建/持久化
// （DB invites 表、过期清理、使用上限）不在范围内，暂以内存表代替。
// 已知令牌 `demo` 解析为一个示例 team 邀请；其余令牌一律 unknown → 404。
// 后续接入 @repo/data 的 getValidInvite / addMember 时替换此处。
type InviteKind = "team" | "room";

interface InviteRecord {
  kind: InviteKind;
  /** 被邀请加入的 team / room 名称（展示用） */
  targetName: string;
  /** 邀请人显示名（展示用） */
  inviterName: string;
  /** 接受后写入当前团队上下文的 team id */
  teamId: number;
  /** room 邀请额外携带的 room id（team 邀请为 null） */
  roomId: number | null;
  /** 过期标记（stub）：true 表示链接已过期 */
  expired?: boolean;
}

const INVITE_STORE: Record<string, InviteRecord> = {
  demo: {
    kind: "team",
    targetName: "Acme Design",
    inviterName: "Jordan Lee",
    teamId: 1,
    roomId: null,
  },
};

function resolve(token: string): InviteRecord | undefined {
  return INVITE_STORE[token];
}

/** GET /api/invite/:token — 解析令牌 → 邀请信息；未知/过期 → 404/expired。 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = String(params.token ?? "");
  const invite = resolve(token);
  if (!invite) {
    return NextResponse.json({ error: "邀请无效或不存在", reason: "unknown" }, { status: 404 });
  }
  if (invite.expired) {
    return NextResponse.json({ error: "邀请已过期", reason: "expired" }, { status: 410 });
  }
  return NextResponse.json({
    invite: {
      token,
      kind: invite.kind,
      targetName: invite.targetName,
      inviterName: invite.inviterName,
    },
  });
}

/** POST /api/invite/:token — 接受邀请 → 加入（需登录）。 */
export async function POST(_req: Request, { params }: { params: { token: string } }) {
  try {
    const user = await currentUser();
    // 接受邀请必须登录（mirror rooms/teams 鉴权）
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const token = String(params.token ?? "");
    const invite = resolve(token);
    if (!invite) {
      return NextResponse.json({ error: "邀请无效或不存在", reason: "unknown" }, { status: 404 });
    }
    if (invite.expired) {
      return NextResponse.json({ error: "邀请已过期", reason: "expired" }, { status: 410 });
    }

    // STUB：真实实现应调用 addMember(invite.teamId, user.id, role) 并 consumeInvite(token)。
    // room 邀请 → 进入房间；team 邀请 → 进入该团队 recent rooms 列表。
    const redirect =
      invite.kind === "room" && invite.roomId != null
        ? `/rooms/${invite.roomId}/boards`
        : "/rooms";

    return NextResponse.json({
      ok: true,
      kind: invite.kind,
      teamId: invite.teamId,
      roomId: invite.roomId,
      redirect,
    });
  } catch (err) {
    // 内部细节只进日志，响应给稳定错误码（ADR-015 / #539 教训）
    console.error("[api] unhandled", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
